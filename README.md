# Markov + Shapley Multi-Touch Attribution

Pipeline Python para atribuição multitoque de canais de marketing usando:

- Cadeias de Markov com efeito de remoção.
- Shapley Values por Monte Carlo.
- ROAS por canal.
- Diagnóstico combinado para recomendações de budget.

O projeto lê jornadas de conversão e não conversão via Metabase, monta uma matriz
de transição com estados de canal e exporta um relatório Excel com atribuição,
ROAS, diagnóstico de presença e recomendações.

## Como Funciona

1. `extract.py` consulta o Metabase e extrai:
   - transições de jornadas convertidas;
   - transições de jornadas não convertidas;
   - taxa de conversão observada;
   - receita real;
   - spend de canais pagos.
2. `markov.py` monta a matriz de transição:
   - `(start)`;
   - canais como `Google Ads`, `Email`, `Direct`, `Organic Search`;
   - `Conversion`;
   - `Non-Conversion`.
3. O modelo Markov calcula o efeito de remoção por canal.
4. O modelo Shapley estima a contribuição marginal média por canal.
5. `roas.py` combina atribuição, spend, presença em jornadas e recomendação.
6. `run.py` gera um relatório para uma janela única.
7. `run_quarter.py` processa períodos maiores mês a mês e consolida o modelo.

## Instalação

Requer Python 3.10+.

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

No PowerShell, configure as variáveis de ambiente:

```powershell
Copy-Item .env.example .env
notepad .env
```

Depois carregue as variáveis no terminal, ou use sua ferramenta preferida de
gerenciamento de ambiente.

Variáveis obrigatórias:

```text
METABASE_URL
METABASE_API_KEY
DB_PLAUSIBLE
DB_DATAMART
START_DATE
END_DATE
```

## Execução

Janela única:

```bash
python run.py
```

Período consolidado mês a mês:

```bash
python run_quarter.py
```

Os arquivos são gerados em `results/`.

## Outputs

O Excel final inclui:

- `Attribution & ROAS`: comparação Markov vs Shapley, spend, ROAS e recomendação.
- `Channel Diagnostics`: presença do canal em início, meio, fim e self-loops.
- `Shapley`: atribuição Shapley isolada.
- `Top Transitions`: transições convertidas mais frequentes.
- `Converting Transitions`: transições de conversão.
- `Non-Conv Transitions`: transições de não conversão.
- `Transition Matrix`: matriz Markov final.

## Leitura Das Recomendações

As recomendações combinam Markov, Shapley e presença:

- `Scale Up - Strong Consensus`: Markov e Shapley concordam.
- `Scale Up - Check Incrementality`: Markov alto, Shapley menor; pede teste.
- `Protect / Assist Channel`: Shapley valoriza o canal como assistente.
- `Scale Down - Weak Consensus`: baixo valor e baixo ROAS nos modelos.
- `Investigate High Presence Low Value`: canal aparece muito, mas gera pouco valor.
- `Non-Paid / Context Channel`: canal relevante, mas sem ação direta de budget.

## Segurança

Não publique credenciais reais. Use `.env` local e mantenha apenas
`.env.example` no repositório.

Se uma `METABASE_API_KEY` já foi commitada ou enviada ao GitHub, revogue e gere
uma nova chave antes de tornar o repositório público.

## Limitações Conhecidas

- A classificação de canais depende de `utm_medium`, `utm_source` e fallback de
  `acquisition_channel`.
- `utm_campaign` é ignorado por inconsistência de nomenclatura.
- Spend de Meta pode estar agregado em um único canal, dependendo da tabela de
  origem.
- `Direct` e `Other` são tratados como contexto/tracking, não como mídia
  acionável.
- O projeto ainda não inclui frontend, API ou histórico persistido dos modelos.

## GoGraph: Sprint 0

Esta base continua sendo o motor offline do GoGraph. A Sprint 0 preserva
`run.py` e `run_quarter.py`, mantem o Excel atual em `results/` e prepara o
codigo para uma migracao incremental.

Para continuidade entre agentes, use tambem
[`docs/GOGRAPH_AGENT_ROADMAP.md`](docs/GOGRAPH_AGENT_ROADMAP.md). Ele consolida
as sprints, criterios de aceite, arquitetura alvo, validacoes e proximas tarefas.

Arquivos atuais:

- `config.py`: parametros analiticos e variaveis de ambiente do Metabase.
- `extract.py`: queries Metabase/ClickHouse/Data Mart e normalizacao de canais.
- `markov.py`: matriz de transicao, probabilidade de conversao, removal effect
  e Shapley Monte Carlo.
- `roas.py`: cruzamento com spend, diagnosticos de canais e recomendacoes.
- `run.py`: execucao de uma janela unica com export Excel.
- `run_quarter.py`: execucao mensalizada para periodos maiores e consolidacao
  local antes do modelo.
- `tests/`: smoke/regression tests locais sem chamada ao Metabase.

Dependencias atuais:

- Runtime: `pandas`, `numpy`, `requests`, `openpyxl`, `python-dotenv`, `tqdm`.
- Desenvolvimento: `pytest`.
- Externas: Metabase API, ClickHouse/Plausible via Metabase e Data Mart de midia.

Principais acoplamentos atuais:

- `run.py` e `run_quarter.py` importam `config.py` diretamente.
- `extract.py` monta SQL e executa Metabase no mesmo modulo.
- `roas.py` mistura metricas diagnosticas e recomendacoes.
- O Excel ainda e o destino principal dos resultados.

Estrutura minima proposta para as proximas sprints, sem migracao grande agora:

```text
gograph/
  backend/
    app/
      api/
      core/
      db/
      models/
      schemas/
      services/
  legacy/
  results/
  tests/
```

Na Sprint 1, os arquivos atuais podem continuar na raiz enquanto novas funcoes
reutilizaveis nascem em `gograph/backend/app/services/`. Depois que os testes
cobrirem o contrato, os entrypoints passam a chamar esses services.

## GoGraph: Sprint 1

A Sprint 1 adiciona uma camada reutilizavel de services sem alterar o fluxo
legado dos scripts.

Novo contrato principal:

```python
from gograph.backend.app.schemas import ModelRunParams
from gograph.backend.app.services.model_service import run_model

params = ModelRunParams(
    start_date="2026-03-01",
    end_date="2026-03-31",
    db_plausible=70,
    db_datamart=63,
    non_conv_scale=1.0,
    shapley_samples=500,
)

result = run_model(params=params)
```

Para testes e reprocessamentos, `run_model` tambem aceita DataFrames injetados:

- `converting_transitions`
- `nonconverting_transitions`
- `spend`
- `total_revenue`
- `observed_conversion_rate`

Services criados:

- `gograph/backend/app/services/extraction_service.py`
- `gograph/backend/app/services/attribution_service.py`
- `gograph/backend/app/services/roas_service.py`
- `gograph/backend/app/services/insight_service.py`
- `gograph/backend/app/services/export_service.py`
- `gograph/backend/app/services/model_service.py`

Os scripts `run.py` e `run_quarter.py` ainda nao foram trocados para chamar os
services. Essa troca deve ser feita apenas depois de validar equivalencia de
output com o Excel atual.

## GoGraph: Sprint 2

A Sprint 2 adiciona persistencia historica de execucoes com SQLAlchemy. O banco
padrao local e SQLite, configurado por:

```text
DATABASE_URL=sqlite:///gograph.db
```

Para Postgres, troque `DATABASE_URL` no `.env` mantendo o mesmo contrato de
services.

Criar tabelas:

```python
from gograph.backend.app.db import create_db_and_tables

create_db_and_tables()
```

Salvar e consultar uma execucao:

```python
from gograph.backend.app.services.model_service import run_model
from gograph.backend.app.services.persistence_service import (
    get_model_run,
    get_model_run_table,
    list_model_runs,
    save_model_run,
)

result = run_model(params=params)
model_run_id = save_model_run(result)

overview = get_model_run(model_run_id)
runs = list_model_runs()
channels = get_model_run_table(model_run_id, "attribution_results")
```

Tabelas MVP criadas:

- `model_runs`
- `transition_counts`
- `transition_matrix`
- `attribution_results`
- `channel_diagnostics`
- `path_summary`
- `data_quality_checks`
- `exports`

Ainda nao ha migrations formais. No MVP, `create_db_and_tables()` cria o schema;
migrations com Alembic devem entrar quando o modelo estabilizar.

## GoGraph: Sprint 3

A Sprint 3 adiciona uma API FastAPI em cima dos services e da persistencia.

Subir localmente:

```powershell
py -m uvicorn gograph.backend.app.main:app --reload
```

Health check:

```text
GET /health
```

Endpoints MVP:

- `POST /model-runs`
- `GET /model-runs`
- `GET /model-runs/{id}`
- `GET /model-runs/{id}/overview`
- `GET /model-runs/{id}/channels`
- `GET /model-runs/{id}/diagnostics`
- `GET /model-runs/{id}/insights`
- `GET /model-runs/{id}/touchpoints`
- `GET /model-runs/{id}/transitions`
- `GET /model-runs/{id}/paths`
- `GET /model-runs/{id}/loops`
- `GET /model-runs/{id}/graph`
- `GET /model-runs/{id}/data-quality`
- `GET /model-runs/{id}/export`

Payload para criar execucao:

```json
{
  "start_date": "2026-03-01",
  "end_date": "2026-03-31",
  "lookback_days": 30,
  "decay_lambda": 0.05,
  "non_conv_sample_pct": 1,
  "non_conv_scale": null,
  "shapley_samples": 5000,
  "db_plausible": 70,
  "db_datamart": 63,
  "batch_mode": "auto",
  "batch_days": 35
}
```

Observacao: `POST /model-runs` aciona o Metabase quando DataFrames nao sao
injetados. Use `.env` real antes de chamar esse endpoint fora dos testes.
O endpoint cria um `model_run` com status `pending` e executa o processamento em
background. Consulte `GET /model-runs` ou `GET /model-runs/{id}/overview` para
acompanhar `pending`, `running`, `completed` ou `failed`.

Periodos longos:

- `batch_mode="auto"` e o padrao.
- Se a janela tiver mais que `MODEL_BATCH_DAYS` dias, as transicoes sao extraidas
  mes a mes e agregadas localmente.
- O modelo Markov/Shapley continua sendo unico para o periodo completo.
- `batch_mode="always"` forca batches mensais.
- `batch_mode="never"` usa a janela unica e pode voltar a sofrer OOM no
  ClickHouse para periodos longos.

## GoGraph: Sprint 4

A Sprint 4 adiciona o dashboard frontend MVP em React/Vite.

Frontend:

```powershell
cd gograph/frontend
npm install
npm run dev
```

Backend:

```powershell
py -m uvicorn gograph.backend.app.main:app --reload
```

URLs locais:

- API: `http://127.0.0.1:8000`
- Frontend: `http://127.0.0.1:5173`

Funcionalidades MVP:

- listar model runs persistidos;
- criar nova execucao via API;
- acompanhar status de execucao com polling automatico;
- selecionar uma execucao;
- ver KPIs de overview;
- ver tabela de canais;
- ver grafico Markov vs Shapley;
- ver ROAS Markov vs Shapley;
- ver diagnosticos de canais;
- ver qualidade dos dados.

O frontend usa `VITE_API_BASE` quando definido; caso contrario, chama
`http://127.0.0.1:8000`.

## GoGraph: Sprint 5

A Sprint 5 adiciona insights automaticos e pontos de contato.

Endpoints:

- `GET /model-runs/{id}/insights`
- `GET /model-runs/{id}/touchpoints`

Metricas de touchpoint:

- `conv_first_touch_share`
- `conv_middle_touch_share`
- `conv_last_touch_share`
- `nonconv_first_touch_share`
- `nonconv_middle_touch_share`
- `nonconv_last_touch_share`
- `starter_count`
- `assist_count`
- `closer_count`
- `dropoff_after_touch`
- `touchpoint_role`

Observacao importante: nesta sprint as metricas sao calculadas a partir de
transicoes agregadas persistidas. Elas respondem "share por posicao de
transicao" dentro de convertidos/nao-convertidos, nao "percentual exato de
jornadas/usuarios que contem o canal". A presenca real por jornada entra melhor
na Sprint 7, quando paths completos forem persistidos.

Insights gerados:

- `Scale Up`
- `Conversion Closer`
- `Assist Channel`
- `Initial Touchpoint`
- `Investigate Dropoff`
- `Low Support / Zero Attribution`

Todo insight inclui evidencia numerica, metrica usada, severidade, confianca,
recomendacao e limitacao sobre incrementalidade causal.

## GoGraph: Sprint 6

A Sprint 6 adiciona o grafo real de jornada a partir das transicoes observadas
persistidas.

Endpoint:

- `GET /model-runs/{id}/graph`

Payload principal:

- `nodes`: estado, tipo, entradas, saidas, receita, ticket medio, centralidade,
  PageRank, flag de self-loop e flag de ciclo.
- `edges`: origem, destino, contagem, probabilidade, receita, ticket medio e
  tipos de transicao.
- `cycles`: ciclos detectados com NetworkX.
- `self_loops`: loops no mesmo canal/estado.
- `summary`: totais de nos, arestas, ciclos e self-loops.

Frontend:

- Aba `Grafo`.
- Visualizacao SVG da jornada observada.
- Filtro top N de arestas.
- Tooltip em no e aresta.
- Destaque visual para `Conversion` e `Non-Conversion`.

Observacao: este grafo ainda usa transicoes agregadas. A persistencia e analise
de caminhos completos por usuario/jornada entram na Sprint 7.
