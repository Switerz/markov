# GoGraph — Atribuição Multitoque de Marketing

## 1. Para que serve

GoGraph é a plataforma interna da GoCase para **atribuir receita aos canais de marketing** a partir de jornadas reais de usuários (sessões + compras). Em vez de confiar em last-click ou first-click — modelos que distorcem o papel de canais de meio de funil — o sistema combina:

- **Cadeia de Markov com removal effect**: mede o quanto a probabilidade de conversão da jornada cai se um canal é removido do grafo de transição.
- **Shapley Values (Monte Carlo)**: estima a contribuição marginal média de cada canal considerando todas as ordens possíveis em que ele aparece nas coalizões de canais.
- **ROAS Markov vs Shapley**: cruza atribuição com spend de mídia (Meta, Google Ads, Display).
- **Diagnóstico de presença**: posição do canal na jornada (first/middle/last touch), self-loops, papel (driver, assist, contexto).

O objetivo final é **decisão de budget**: o output diz, para cada canal, se deve ser escalado, mantido, investigado por incrementalidade ou cortado.

## 2. Quem usa

- **Time de Growth/Mídia**: lê o relatório Excel mensal/trimestral e o dashboard web para decidir realocação de budget.
- **Time de Dados/Modelagem**: roda execuções via API, compara cenários, audita qualidade dos dados.
- **Análise ad-hoc**: sandbox no frontend permite simular "e se eu cortar canal X" sem rodar o modelo do zero.

## 3. Arquitetura

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   Metabase (Plausible/ClickHouse + Data Mart)                            │
│     └─ sessões com utm_medium/utm_source + purchases + spend             │
│                                                                          │
│            │  SQL nativo via API                                         │
│            ▼                                                             │
│                                                                          │
│   extract.py  →  pandas DataFrames                                       │
│                                                                          │
│            │                                                             │
│            ▼                                                             │
│                                                                          │
│   markov.py / Shapley / roas.py / serviços em                            │
│   gograph/backend/app/services/                                          │
│                                                                          │
│            │                                                             │
│            ├──► results/*.xlsx        (modo CLI: run.py / run_quarter.py)│
│            │                                                             │
│            └──► SQLite (gograph.db)   (modo API: persiste ModelRun)      │
│                                                                          │
│            │                                                             │
│            ▼                                                             │
│                                                                          │
│   FastAPI (uvicorn :8000)  →  React + Vite + xyflow + recharts (:5173)   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Camadas

| Camada | Caminho | Stack |
|---|---|---|
| Extração | `extract.py`, `gograph/backend/app/services/extraction_service.py` | `requests` + Metabase API |
| Modelagem | `markov.py`, `roas.py`, `gograph/backend/app/services/model_service.py` | `pandas`, `numpy` |
| Persistência | `gograph/backend/app/db/` | SQLAlchemy + SQLite (`gograph.db`) |
| API | `gograph/backend/app/api/` + `main.py` | FastAPI + uvicorn |
| Frontend | `gograph/frontend/src/` | React 19 + Vite 7 + `@xyflow/react` + `recharts` + `lucide-react` |
| CLI legado | `run.py`, `run_quarter.py` | Excel via `openpyxl` |

## 4. Dados de entrada

Origem: **Metabase**, que proxia duas fontes:

- **DB_PLAUSIBLE (id 70)** — ClickHouse com eventos de sessão do Plausible (page views, eventos custom, identificação por user_id quando disponível).
- **DB_DATAMART (id 63)** — Data mart relacional com `google_ads_consolidated` e `vw_meta_segment_performance` (spend por canal/dia/segmento).

### Eventos e classificação de canal

Cada sessão é classificada em um dos `TRACKED_STATES` baseando-se em `utm_medium` + `utm_source` (intencionalmente **ignora `utm_campaign`** por inconsistência de naming entre Google Ads CPC, PMax, Demand Gen etc.). Estados:

**Paid**
- `Paid Meta Ads`
- `Google Ads` (Search + Shopping + PMax + Demand Gen unificados)
- `Display / Retargeting`

**CRM / owned**
- `Email`
- `WhatsApp CRM`
- `SMS`

**Organic**
- `Organic Social / Instagram`
- `Organic Social / Facebook`
- `Organic Search`
- `Direct`

**Misc / contexto**
- `Influencers`
- `Clube GoCase`
- `Referral`
- `Other`

**Estados especiais**
- `(start)`, `Conversion`, `Non-Conversion`

### Janela e amostragem

- `START_DATE` / `END_DATE`: janela de análise (default mensal).
- `LOOKBACK_DAYS = 30`: olhar até 30 dias antes de cada compra para montar a jornada.
- `NON_CONV_SAMPLE_PCT = 1`: amostra 1% dos não-convertedores (universo muito maior).
- `NON_CONV_SCALE`: calibrado automaticamente para que `P(Conversion|start)` do modelo bata com a taxa de conversão observada.
- `DECAY_LAMBDA = 0.05`: decaimento exponencial por dia de antecedência (~50% de peso a 14 dias).
- `CENSORSHIP_DAYS`: horizonte de censura para não-convertedores recentes (jornada ainda não terminada).
- `SHAPLEY_SAMPLES = 5000`: amostras Monte Carlo (~5–10s para ~17 estados).

## 5. Dados de saída

### CLI (`run.py`)
Excel em `results/attribution_<start>_<end>.xlsx` com sheets:

- `Attribution & ROAS` — Markov vs Shapley vs spend + recomendação
- `Channel Diagnostics` — presença first/middle/last + self-loops + role
- `Shapley` — pesos Shapley isolados
- `Top Transitions` — pares (origem → destino) mais frequentes em jornadas convertidas
- `Converting Transitions` / `Non-Conv Transitions` — contagens brutas
- `Transition Matrix` — matriz P final usada pelo modelo

### API (`POST /model-runs`)
Persiste no SQLite (`gograph.db`) — tabelas em `gograph/backend/app/db/models.py`:

| Tabela | Conteúdo |
|---|---|
| `model_runs` | Execução: parâmetros, datas, status, conversion rate observada vs modelada, revenue, runtime |
| `transition_counts` | Contagens brutas por par (canal_from → canal_to) e tipo (conv/non-conv) |
| `transition_matrix` | Matriz P final pós-normalização e calibração |
| `attribution_results` | Resultados Markov + Shapley + ROAS por canal |
| `channel_diagnostics` | Presença, posição na jornada, role, label diagnóstico |
| `path_summary` | Jornadas mais frequentes e sua receita |
| `data_quality_checks` | Validações automáticas (severidade + detalhe) |
| `loop_diagnostics` | Auto-transições (canal → ele mesmo) |
| `funnel_state_attribution` | Atribuição cruzada com estágios de funil |
| `sequential_effects` | Efeitos de ordem (canal X depois de Y) |
| `scenarios` | Cenários "e se" do sandbox |
| `exports` | Histórico de exports gerados |

### Endpoints REST principais (`/docs` no FastAPI)

```
POST   /model-runs                       cria execução (background task)
GET    /model-runs                       lista execuções persistidas
GET    /model-runs/{id}                  detalhe da execução
GET    /model-runs/{id}/overview         KPIs agregados
GET    /model-runs/{id}/channels         tabela por canal (Markov/Shapley/ROAS)
GET    /model-runs/{id}/diagnostics      presença + role + recomendação
GET    /model-runs/{id}/insights         insights textuais por canal
GET    /model-runs/{id}/touchpoints      métricas por touchpoint
GET    /model-runs/{id}/transitions      transições com pesos
GET    /model-runs/{id}/paths            jornadas mais frequentes
GET    /model-runs/{id}/loops            self-loops e padrões cíclicos
GET    /model-runs/{id}/graph            grafo (nodes + edges) para xyflow
GET    /model-runs/{id}/funnel-attribution
GET    /model-runs/{id}/sequential-effects
GET    /model-runs/{id}/data-quality
```

E `/sandbox/*` para criar, comparar e remover cenários simulados.

## 6. Frontend

`gograph/frontend/` — SPA React 19 + Vite 7 + TypeScript estrito. Arquitetura modular por feature, design-system compartilhado e tokens visuais centrais.

### Stack
- React Router v6 (BrowserRouter via `createBrowserRouter`)
- @tanstack/react-query 5 (server state)
- @tanstack/react-table 8 (tabelas)
- @radix-ui/react-* (dialog, tabs, select, slider, switch, tooltip, popover, dropdown-menu)
- react-hook-form + zod (formulários)
- recharts + @nivo/sankey + @xyflow/react (gráficos e grafo)
- lucide-react (ícones)
- Vitest + Testing Library (testes)

### Estrutura

```
src/
├── app/         AppShell, Sidebar, TopBar, routes.tsx, Providers
├── shared/      ui/ (primitivos), charts/, format/, hooks/, icons/, tokens/
├── features/    overview/, budget-decisions/, channel-360/, journeys/, experiments/, executions-quality/
├── lib/         api.ts (HTTP client tipado)
└── test/        setup.ts (polyfills jsdom para Radix)
```

Cada feature segue o mesmo formato: `<Feature>Page.tsx`, `types.ts`, `<feature>.mock.ts`, `hooks/use<Feature>Data.ts`, e `components/` para as seções da tela.

### Telas

| Rota | Feature | Descrição |
|---|---|---|
| `/` | `overview` | KPIs, decisões prioritárias, consenso de modelos, resumo de jornada, confiança da análise |
| `/decisoes-de-budget` | `budget-decisions` | Matriz de alocação (bubble chart), tabela de canais, drawer detalhado por canal |
| `/decisoes-de-budget/canais/:slug` | `channel-360` | Métricas + atribuição + papel na jornada + sequências + evolução temporal de um canal específico |
| `/jornadas` | `journeys` | Sankey de fluxo, grafo (xyflow), builder de jornada, top paths, matriz de transição, loops |
| `/experimentos` | `experiments` | Construtor de cenários, baseline vs cenário, waterfall de redistribuição, insights, comparação |
| `/execucoes-e-qualidade` | `executions-quality` | Histórico de execuções, Trust Center, comparação entre execuções, painel de detalhes |

### Tokens

Definidos em `src/shared/tokens/tokens.css` e re-exportados como `Tone` em `tokens.ts`. Paleta: `blue / green / red / orange / indigo / cyan / neutral` (sem purple — substituído por indigo após auditoria do impeccable). Tipografia: Geist (display) + Inter (body). Contraste de texto secundário ajustado para WCAG AA.

### Convenções

1. Componentes em `shared/` não conhecem domínio — recebem `data` + `config` via props.
2. Nenhum cross-feature import — helpers compartilhados sobem para `shared/`.
3. Mocks por tela em `<feature>/<feature>.mock.ts` espelhando o JSON do contrato em `docs/gograph-refactor-instrucoes/`. Marcados com `TODO(api):` onde o endpoint ainda não cobre.
4. Convenção de query keys do React Query documentada no fim de `lib/api.ts`.
5. Detalhes adicionais em [`gograph/frontend/README.md`](../gograph/frontend/README.md).

## 7. Recomendações geradas

Cruzando Markov × Shapley × presença × spend, o modelo classifica cada canal em:

| Label | Significado |
|---|---|
| `Scale Up - Strong Consensus` | Markov e Shapley concordam — investir mais |
| `Scale Up - Check Incrementality` | Markov alto, Shapley menor — pede teste incremental |
| `Protect / Assist Channel` | Shapley alto, role de assistente |
| `Scale Down - Weak Consensus` | Baixo valor em ambos os modelos |
| `Investigate High Presence Low Value` | Aparece em muitas jornadas mas não gera valor — possível tracking/spam |
| `Non-Paid / Context Channel` | Canal relevante sem ação direta de budget |
| `Hold / Monitor` | Estável, sem sinal forte |

## 8. Limitações conhecidas

- Classificação depende de UTMs corretas; jornadas com UTM ausente caem em `Direct` ou `Other`.
- `utm_campaign` é ignorado por inconsistência de naming (Google CPC types compartilham medium/source).
- Spend de Meta pode estar agregado em um único bucket dependendo da granularidade da view de origem.
- Cross-device tracking depende de identificação de usuário; sessões anônimas geram jornadas fragmentadas.
- Modelo é **descritivo, não preditivo** — atribui valor a canais com base em padrões históricos da janela analisada; não prevê o futuro nem responde causalidade real (precisa de testes incrementais para isso).

## 9. Como rodar

### Setup
```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env  # preencher METABASE_URL e METABASE_API_KEY
cd gograph/frontend && npm install
```

### CLI (Excel)
```bash
source .venv/bin/activate
python run.py             # janela única (config.START_DATE → config.END_DATE)
python run_quarter.py     # período longo, batches mensais
```

### Stack web completa
```bash
./dev.sh
# API   → http://127.0.0.1:8000  (docs em /docs)
# Front → http://127.0.0.1:5173
```

## 10. Estrutura de pastas

```
markov/
├── config.py                    parâmetros + env loading
├── extract.py                   queries Metabase + normalização de canal
├── markov.py                    matriz de transição, removal effect, Shapley
├── roas.py                      cruzamento com spend, diagnósticos, recomendações
├── run.py                       CLI janela única (gera Excel)
├── run_quarter.py               CLI multi-mês consolidado
├── dev.sh                       sobe API + frontend juntos
├── requirements.txt
├── .env / .env.example
├── results/                     Excels gerados
├── gograph.db                   SQLite com histórico de model_runs
├── gograph/
│   ├── backend/
│   │   └── app/
│   │       ├── main.py          FastAPI factory
│   │       ├── api/             rotas /model-runs e /sandbox
│   │       ├── core/            event mapping, lógica compartilhada
│   │       ├── db/              SQLAlchemy models + session
│   │       ├── schemas/         Pydantic schemas
│   │       └── services/        services reutilizáveis (modelo, persistência, ROAS, paths, loops, sandbox…)
│   └── frontend/
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
│           ├── App.tsx          shell + tabs + chamadas a /model-runs
│           ├── SandboxView.tsx  cenários "e se"
│           ├── api.ts           cliente HTTP tipado
│           └── styles.css
├── docs/
│   ├── GOGRAPH_AGENT_ROADMAP.md  sprints e roadmap consolidado
│   └── PROJECT.md                este documento
└── tests/                       smoke/regression sem chamadas à Metabase
```

## 11. Glossário rápido

- **Removal effect**: queda da probabilidade de conversão quando o canal é removido do grafo. Base do peso Markov.
- **Shapley value**: contribuição marginal média do canal entre todas as ordens possíveis de coalizões.
- **Touchpoint**: ocorrência de um canal numa jornada (uma jornada tem N touchpoints).
- **First/middle/last touch**: posição relativa do canal na jornada — usado para classificar role (driver vs assist).
- **Self-loop**: transição canal X → canal X consecutiva (sessão dupla do mesmo canal).
- **Calibração de NON_CONV_SCALE**: fator multiplicativo aplicado às transições de não-conversão para que `P(Conversion|start)` do modelo bata com a taxa observada — corrige o viés introduzido pelo downsample dos não-convertedores.
- **Censura à direita**: não-convertedores recentes cuja jornada ainda pode terminar em conversão. `CENSORSHIP_DAYS` exclui essa cauda do cálculo.
