# GoGraph Agent Roadmap

Documento de continuidade para agentes que forem evoluir este repositorio.
Atualizado em: 2026-06-03.

---

## Estado Atual (2026-06-03)

O projeto esta em producao como produto analitico completo. O motor de Markov/Shapley
roda via API FastAPI com frontend React. O modelo principal e o **Funnel Stage Markov**
(Events V2 ativo), com Raw Channel como baseline de comparacao.

### Stack

- Backend: FastAPI + SQLAlchemy + SQLite (`gograph.db`)
- Frontend: React 19 + Vite + Recharts + XYFlow
- Extracao: Metabase API -> ClickHouse (`plausible_events_db`) + Data Mart (`DB 63`)
- Motor: Markov Chain ordem-1 + Shapley Monte Carlo

### Subir o projeto localmente

```powershell
# Backend (porta 8001 recomendada -- ver nota de portas abaixo)
py -m uvicorn gograph.backend.app.main:app --host 127.0.0.1 --port 8001

# Frontend
cd gograph/frontend
# Criar .env.local com: VITE_API_BASE=http://127.0.0.1:8001
npm run dev
```

**Nota de portas:** A porta 8000 pode ter socket fantasma no Windows apos kills forcados.
Use 8001. O frontend precisa de `.env.local` com `VITE_API_BASE=http://127.0.0.1:8001`.

### Migracao de banco (se gograph.db existir de versao anterior)

SQLAlchemy `create_all()` nao adiciona colunas a tabelas existentes. Rode manualmente:

```python
import sqlite3
conn = sqlite3.connect('gograph.db')
cur = conn.cursor()
cur.execute("ALTER TABLE model_runs ADD COLUMN funnel_model_active INTEGER DEFAULT 0")
cur.execute("ALTER TABLE attribution_results ADD COLUMN model_type TEXT DEFAULT 'raw'")
conn.commit(); conn.close()
```

### Testes

```powershell
py -m pytest tests/ -q --ignore=tests/test_api_model_runs.py
# 90 testes passando (test_api_model_runs.py tem 1 falha pre-existente no /health)
```

### Resultado atual (Run 37 -- referencia)

Periodo: 5 mar -- 1 jun 2026 | Lookback: 30 dias | Receita: R$139M | Spend: R$21,5M

| Canal | Funnel Markov | Funnel Shapley | Raw Markov | ROAS Markov | ROAS Shapley |
|---|---|---|---|---|---|
| Google Ads | 29,2% | 15,7% | 55,4% | 11,26x | 6,06x |
| Paid Meta Ads | 5,3% | 11,3% | 0% | 0,50x | 1,06x |
| Org. Instagram | 5,4% | 7,3% | 13,5% | -- | -- |
| WhatsApp CRM | 5,2% | 7,2% | 7,7% | 2,71x | 3,74x |
| Email | 4,9% | 8,1% | 11,5% | -- | -- |
| Direct | 4,6% | 10,3% | 0% | -- | -- |
| Organic Search | 3,5% | 7,8% | 6,1% | -- | -- |
| SMS | 0,3% | 5,0% | 1,1% | 1,01x | 18,63x |

---

## Regras De Continuidade

- Nao quebrar `run.py` nem `run_quarter.py`.
- Nao mover o motor inteiro de uma vez.
- Preservar o Excel atual enquanto a API/persistencia nasce.
- Nao hardcodar credenciais, tokens, emails pessoais, URLs produtivas ou IDs de conta.
- Usar `.env` para valores sensiveis e `.env.example` para contrato publico.
- Antes de qualquer mudanca grande, rodar pelo menos smoke imports e testes locais.
- Distinguir atribuicao comportamental de incrementalidade causal em textos e insights.
- Tratar `Direct`, `Other`, `Referral` e organicos como canais de contexto quando aplicavel.
- Nao calcular ROAS segmentado sem spend na mesma granularidade.
- **Raw Markov/Shapley ordem-1 e o baseline imutavel.** O Funnel Stage e primario mas nunca substitui o Raw -- ambos devem coexistir.
- `Low Intent` nao recebe removal effect no modelo Funnel (decisao arquitetural deliberada -- ver Sprint 13).

---

## Modelo Matematico Que Deve Ser Preservado

- Jornadas iniciam em `(start)` e terminam em `Conversion` ou `Non-Conversion`.
- Contagens de transicao combinam convertidos e nao convertidos com `NON_CONV_SCALE`.
- A matriz de transicao e normalizada por linha.
- Probabilidade de conversao usa matriz fundamental de cadeia absorvente.
- Removal effect e a queda de `P(Conversion | start)` ao remover um canal.
- Atribuicao Markov normaliza removal effects positivos.
- Shapley usa Monte Carlo sobre contribuicoes marginais de coalizoes.
- Receita atribuida multiplica peso por receita total real.
- ROAS so e calculado quando existe spend confiavel por canal.
- **No Funnel Stage Markov:** estados `canal / Low Intent` sao excluidos do removal effect porque representam audiencia nao-attributavel. Apenas `Product Interest`, `Cart Intent`, `Checkout` e `Purchase` entram no calculo de remocao.

---

## Arquitetura De Modelos

```text
Raw Channel Markov/Shapley (ordem-1, canal puro)
  -> sempre calculado
  -> salvo em attribution_results com model_type='raw'
  -> disponivel em GET /model-runs/{id}/raw-channels

Funnel Stage Markov/Shapley (canal + estagio de intencao)
  -> calculado quando Events V2 disponivel
  -> salvo em attribution_results com model_type='funnel'
  -> disponivel em GET /model-runs/{id}/channels (primario)
  -> model_runs.funnel_model_active = true quando ativo

Diagnosticos (sempre calculados a partir de raw_paths)
  -> loop_diagnostics: metricas de auto-loop por canal
  -> sequential_effects: P(Conv | anterior, atual) vs baseline
  -> funnel_state_attribution: Markov/Shapley por estado composto
```

---

## Sprints

### Sprint 0 - Auditoria e Estabilizacao

Status: **concluido**.

Configuracao de `.env`, `.env.example`, `.gitignore`, `requirements.txt`,
smoke tests de importacao, documentacao minima.

### Sprint 1 - Refatoracao Do Motor Analitico

Status: **concluido**.

Criados `extraction_service.py`, `model_service.py`, `attribution_service.py`,
`roas_service.py`, `insight_service.py`, `export_service.py`. `ModelRunParams`
e `ModelRunResult` como contratos de dados. `run_model(...)` como ponto unico
de orquestracao.

### Sprint 2 - Persistencia e Historico

Status: **concluido**.

SQLAlchemy + SQLite (`gograph.db`). Tabelas: `model_runs`, `transition_counts`,
`transition_matrix`, `attribution_results`, `channel_diagnostics`, `path_summary`,
`data_quality_checks`, `exports`. `save_model_run`, `list_model_runs`,
`get_model_run`, `get_model_run_table`. Sem Alembic formal -- migrations manuais
via ALTER TABLE quando necessario.

### Sprint 3 - API Backend FastAPI

Status: **concluido**.

App FastAPI em `gograph/backend/app/main.py`. Endpoints em
`gograph/backend/app/api/model_runs.py` e `gograph/backend/app/api/sandbox.py`.
`POST /model-runs` roda em background (polling ate completed/failed).
CORS configurado para localhost:5173 e 5174.

### Sprint 4 - Dashboard Frontend MVP

Status: **concluido**.

React 19 + Vite em `gograph/frontend`. Abas: Overview, Canais, Grafo,
Insights, Pontos de Contato, Diagnosticos, Qualidade, Caminhos, Sandbox,
Diagnosticos de Modelo. Estados de loading, erro e vazio.

### Sprint 5 - Insights e Pontos De Contato

Status: **concluido**.

`compute_touchpoint_metrics` e `generate_channel_insights`. Endpoints
`/insights` e `/touchpoints`. Abas frontend `Insights` e `Pontos`.
Limite: presenca baseada em transicoes agregadas, nao por jornada individual.

### Sprint 6 - Grafos Reais De Jornada

Status: **concluido**.

`GET /model-runs/{id}/graph` com nodes, edges, probabilidades, centralidade,
PageRank, self-loops e ciclos via NetworkX. Frontend com SVG interativo,
filtro top N, tooltips, legenda e destaque de nos especiais.

### Sprint 7 - Caminhos, Loops e Path Intelligence

Status: **concluido**.

`get_raw_paths` em `extract.py`. `enrich_raw_paths` em `path_service.py`.
Top 500 paths persistidos por run. Metricas: conversion_rate, revenue,
avg_ticket, path_probability, contains_loop, confidence_score.
Endpoint `GET /model-runs/{id}/paths` e aba `Caminhos` no frontend.

### Sprint 8 - Sandbox De Grafos

Status: **concluido**.

CRUD de cenarios em `sandbox_service.py` e `sandbox.py`. Modelo `Scenario`
com nodes, edges e path_channels. Analise: path_probability,
composite_conversion_probability, expected_revenue, expected_ticket,
historical_support, similar_paths, warnings, confidence_score.
Frontend com `@xyflow/react`, canvas interativo, paleta de canais.
24 testes passando em `test_sandbox_service.py`.

### Sprint 9 - Comparador De Cenarios

Status: **concluido**.

`POST /sandbox/compare` aceita N cenarios + flags `include_baseline` e
`include_top_path`. Retorna winner por conversao/receita/confianca e delta
(B - A) para 2 itens. Frontend com modo "Comparar", checkboxes de selecao,
toggles de referencia, tabela side-by-side com destaque de vencedor.

### Sprint 10 - Event Enrichment e Funnel Stage Mapping

Status: **concluido** (2026-06-03).

**Objetivo:** usar eventos reais da tabela `plausible_events_db.events_v2`
para classificar cada sessao por estagio de intencao de compra.

**O que foi feito:**

- `gograph/backend/app/core/event_mapping.py`: mapeamento de eventos para
  estagios de funil. Estagios em ordem crescente:
  `Low Intent < Product Interest < Cart Intent < Checkout < Purchase`.
  Eventos mapeados (confirmados em events_v2, mar-jun 2026):
  - Product Interest: `view_item` (83M), `search` (5,7M)
  - Cart Intent: `add_to_cart` (6,3M), `view_cart` (12M), `start_cart` (1,3M)
  - Checkout: `begin_checkout` (5,7M), `checkout_view_address` (6,1M),
    `checkout_view_delivery` (3,4M), `checkout_view_payment` (1,7M)
  - Purchase: `purchase` (726K)
  - Removidos: `view_item_list`, `apply_coupon` (ruido/acao auxiliar)

- `extract.py`: adicionadas `get_session_events()` e `get_funnel_enriched_paths()`.
  Join `sessions_v2 <-> events_v2` via `session_id` (UInt64).
  Usa `nullIf(stage_label, '')` antes de `coalesce('Low Intent')` para tratar
  string vazia como NULL (comportamento ClickHouse).

- Cada sessao recebe o estagio maximo atingido. Sessoes sem eventos relevantes
  ficam como `Low Intent`.

- `parse_funnel_state()` usa regex ancorado nos nomes de estagios, nao split
  por ` / `, para suportar canais com ` / ` no nome como
  `"Organic Social / Instagram"`.

**Schema da tabela events_v2:**
```
timestamp (DateTime), session_id (UInt64), user_id (UInt64),
name (LowCardinality(String)), site_id (UInt64), hostname, pathname,
utm_medium, utm_source, utm_campaign, meta.key/meta.value arrays,
revenue_reporting_amount (Nullable Decimal), acquisition_channel, ...
```

### Sprint 11 - Auto-Loop Compression e Loop Diagnostics

Status: **concluido** (2026-06-03).

**Objetivo:** diagnosticar auto-loops por canal sem perder informacao.

**O que foi feito:**

- `gograph/backend/app/services/loop_service.py`:
  - `compress_consecutive_loops()`: comprime sequencias repetidas do mesmo canal
  - `compute_loop_diagnostics()`: metricas por canal -- self_loop_rate,
    avg/median/max_consecutive_repeats, loop_conversion_rate,
    nonloop_conversion_rate, loop_conversion_lift, exit_distribution_json
  - `build_compressed_transition_counts()`: gera transicoes compatíveis com
    o motor Markov a partir de paths comprimidos

- Nova tabela SQLite `loop_diagnostics`.

- `GET /model-runs/{id}/loop-diagnostics` expoe os dados.

- Aba "Diagnosticos" no frontend mostra tabela com lift por canal.

**Achados (Run 37):**
- Meta: 35,7% de paths com loop, media 6,2 repeticoes, lift 2,62x
- WhatsApp CRM: lift 3,12x (maior entre CRM)
- Direct: lift 3,34x (usuarios que retornam direto tem alta intencao)
- Other: lift 0,32x (loops de "Other" sao ruido/bot)

### Sprint 12 - Maturity/Censorship Labeling

Status: **parcialmente implementado** (2026-06-03).

O parametro `CENSORSHIP_DAYS` em `.env` ja existe e funciona: exclui usuarios
cujo ultimo toque foi dentro de N dias do `end_date` (outcome desconhecido).
O que ainda falta:
- Classificacao `Pending` explicita (atualmente so exclui, nao diagnostica)
- Metricas de pending por canal no frontend
- Comparacao modelo atual vs maturity-aware no dashboard

### Sprint 13 - Funnel Stage Markov/Shapley

Status: **concluido e promovido a modelo primario** (2026-06-03).

**Objetivo:** criar modelo Markov/Shapley com estados compostos
`canal / estagio` para separar audiencia de baixa intencao do sinal de
alta intencao.

**O que foi feito:**

- `gograph/backend/app/services/funnel_markov_service.py`:
  - `run_funnel_markov()`: constroi matriz de transicao sobre ~70 estados
    compostos, calcula removal effects e Shapley
  - `_removal_effect_channel()`: remove apenas estados de alta intencao
    (`Product Interest`, `Cart Intent`, `Checkout`, `Purchase`). Estados
    `Low Intent` sao EXCLUIDOS do removal effect porque representam audiencia
    nao-attributavel -- inclui-los causaria efeito zero ou negativo para Meta
    (removê-los melhora P(Conv) pois sao dreno para Non-Conversion).
  - `compare_models()`: delta entre Raw Channel e Funnel Stage

- Nova tabela SQLite `funnel_state_attribution`.

- `GET /model-runs/{id}/funnel-attribution` expoe atribuicao por estado.

**Hierarquia de modelos (inversao implementada):**
```
Quando Events V2 disponivel:
  PRIMARY  -> Funnel Stage Markov (GET /channels)
  BASELINE -> Raw Channel Markov  (GET /raw-channels)

Quando Events V2 indisponivel (fallback gracioso):
  PRIMARY  -> Raw Channel Markov
```

- `model_runs.funnel_model_active` (INTEGER, 0/1) indica qual modelo esta ativo.
- `attribution_results.model_type` ('funnel' ou 'raw') distingue os resultados.

**Achados (Run 37, Mar-Jun 2026):**
- Meta: 0% Raw -> 5,3% Funnel Markov | 0% Raw -> 11,3% Funnel Shapley
- Google: 55,4% Raw -> 29,2% Funnel Markov
- Direct: 0% Raw -> 4,6% Funnel Markov (trafego direto de alta intencao)
- Meta / Purchase: 17,1% Markov, 6,9% presenca em conversores, 0% em NC

**ROAS Meta com Funnel:**
- Markov: R$7,4M / R$14,9M spend = 0,50x (abaixo do break-even)
- Shapley: R$15,7M / R$14,9M spend = 1,06x (margem minima positiva)

**Sanity check Meta/Purchase (confirmado):** 147.484 compras tiveram a sessao
de conversao via Meta (21% do total). O sinal e real, nao artifact.

### Sprint 14 - Order-2 Sequential Diagnostics

Status: **concluido** (2026-06-03).

**Objetivo:** diagnostico de efeitos sequenciais -- P(Conversao | anterior, atual)
vs P(Conversao | atual). Responde: "Google converte melhor quando vem depois de Meta?"

**O que foi feito:**

- `gograph/backend/app/services/sequential_service.py`:
  - `compute_sequential_effects()`: para cada bigrama (prev, curr) calcula
    pair_count, conversion_probability_pair, conversion_probability_baseline,
    lift_vs_baseline, diagnostic_label (positive_assist / negative_assist /
    possible_loop / neutral / low_support)
  - `filter_meta_diagnostics()`, `get_top_assists()`, `get_worst_assists()`

- Nova tabela SQLite `sequential_effects`.

- `GET /model-runs/{id}/sequential-effects?previous_channel=...` expoe os dados.

**Achados (Run 37):**
- Meta -> Google: lift 0,46x (usuarios de Meta que vao ao Google convertem
  a metade da taxa normal do Google -- audiencia de menor qualidade)
- Meta -> WhatsApp CRM: lift 0,24x (pior combinacao)
- Google -> Email: lift 1,65x (positive assist -- usuarios captados via Google
  que recebem email convertem 65% acima do baseline)
- Referral -> Direct: lift 3,21x (maior positive assist com suporte razoavel)
- Google -> Direct: lift 2,18x (lembranca de marca apos busca)

### Sprint 15 - UI, Comparacao e Validacao

Status: **concluido** (2026-06-03).

**O que foi feito:**

- Aba "Diagnosticos" no frontend com 3 secoes:
  - Loop Diagnostics (Sprint 11)
  - Funnel Stage Attribution com decomposicao por estagio (Sprint 13)
  - Sequential Effects com filtro por canal anterior (Sprint 14)
  - Comparador Raw vs Funnel

- Badge de modelo ativo no Overview (azul quando Funnel ativo).

- Aba Canais mostra coluna `raw_markov_weight` quando Funnel ativo.

- ROAS formatado com sufixo `x` (evita valores < 1 serem exibidos como %).

- `GET /raw-channels` sempre disponivel como endpoint de baseline.

- Frontend apontado para porta 8001 via `.env.local`.

---

## Pendencias e Proximas Iteracoes

### Pendencias tecnicas imediatas

1. **Alembic para migrations formais:** atualmente o schema e migrado manualmente
   via ALTER TABLE. Implantar Alembic para controle de versao do banco.

2. **Sprint 12 completa -- Pending classification:** classificar usuarios recentes
   como `Pending` em vez de `Non-Conversion` definitivo. Criar diagnostico de
   pending por canal (especialmente relevante para Meta com ciclo de
   consideracao longo).

3. **Exportacoes:** Excel completo pela UI ainda nao implementado. O endpoint
   `POST /model-runs/{id}/export` registra paths mas nao gera o arquivo.

### Proximas investigacoes de negocio

4. **Lookback 60-90 dias para Meta no Funnel:** lb=30 dias nao moveu o Raw
   Markov de Meta. No Funnel, testar lb=60 para capturar jornadas onde Meta
   plantou a semente semanas antes da compra via outro canal.

5. **SMS com Shapley 18,63x:** divergencia extrema entre Markov (1,01x) e Shapley
   (18,63x). SMS e dispensavel isoladamente mas muito valioso em coalizoes.
   Investigar em quais sequencias de canais o SMS aparece.

6. **Otimizacao de audiencia Meta:** o modelo tem granularidade para medir se uma
   mudanca de segmentacao no Meta move a proporcao `Meta / Purchase` vs
   `Meta / Low Intent`. Essa e a alavanca de negocio mais clara.

7. **Incrementalidade de Google:** Google tem Markov 29,2% vs Shapley 15,7% (13pp
   de divergencia). Pode estar capturando busca de marca que converteria de
   qualquer forma. Considerar teste de holdout ou geo-lift.

---

## Riscos e Cuidados

- `events_v2.session_id` e `sessions_v2.session_id` sao ambos UInt64. Nao
  converter para string no join (causa perda de performance e possiveis misses).
- `parse_funnel_state()` usa regex ancorado nos nomes de estagios. Se novos
  estagios forem adicionados em `FUNNEL_STAGES`, atualizar `_STAGE_SUFFIX_RE`
  em `event_mapping.py`.
- `compute_roas` espera `shapley_value` (alem de `shapley_weight` e
  `shapley_revenue`) para o merge interno. Ao criar novos modelos que usam
  `compute_roas`, garantir que o DataFrame de Shapley inclui essa coluna.
- O Funnel Stage Markov usa `non_conv_scale` calibrado do Raw Channel. Isso e
  uma aproximacao -- o Funnel tem mais estados e a calibracao ideal seria
  independente. Para experimentos de precisao, considerar calibracao separada.
- Spend de Meta pode estar agregado em nivel de conta (Facebook+Instagram juntos).
  Instagram organico aparece nas jornadas mas sem spend correspondente.
- Porta 8000 pode ter socket fantasma no Windows apos kills forcados.
  Usar 8001 ou reiniciar o sistema operacional.
- `test_api_model_runs.py` tem 1 falha pre-existente: o endpoint `/health`
  retorna `censorship_days` alem de `status`, e o teste esperava apenas
  `{"status": "ok"}`. Nao e uma regressao desta sessao.

## Validacao Recomendada

```powershell
# Testes (ignora falha pre-existente em test_api_model_runs.py)
py -m pytest tests/ -q --ignore=tests/test_api_model_runs.py

# Smoke imports
py -c "import config, extract, markov, roas; print('imports ok')"
py -c "from gograph.backend.app.core.event_mapping import assign_funnel_stage; print(assign_funnel_stage(['purchase']))"

# Verificar schema do banco
py -c "import sqlite3; c=sqlite3.connect('gograph.db'); cur=c.cursor(); cur.execute('PRAGMA table_info(model_runs)'); print([r[1] for r in cur.fetchall()])"
# Deve incluir: funnel_model_active
# attribution_results deve incluir: model_type
```
