# GoGraph Agent Roadmap

Documento de continuidade para agentes que forem evoluir este repositorio de um
pipeline offline de atribuicao multitoque para o produto analitico GoGraph.

## Estado Atual

O repositorio ainda e um pipeline Python offline. O motor principal esta na raiz:

- `config.py`: parametros de modelagem e env vars.
- `extract.py`: extracao via Metabase API e queries ClickHouse/Data Mart.
- `markov.py`: matriz de transicao, probabilidade de conversao, removal effect,
  atribuicao Markov e Shapley Monte Carlo.
- `roas.py`: ROAS, diagnosticos de canal e recomendacoes.
- `run.py`: execucao de janela unica e export Excel.
- `run_quarter.py`: execucao mensalizada para periodos maiores.
- `results/`: outputs atuais.
- `tests/`: testes locais.

Mudancas ja feitas na Sprint 0:

- `config.py` carrega `.env` via `python-dotenv`.
- `requirements.txt` existe e inclui dependencias atuais.
- `.env.example` existe com placeholders.
- `.gitignore` ignora `.env`, `.mcp.json`, `results/` e venv local.
- Smoke tests de importacao foram adicionados em `tests/test_smoke_imports.py`.
- README documenta a auditoria inicial e a estrutura minima proposta.

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

## Arquitetura Alvo

Estrutura incremental recomendada:

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
    main.py
  frontend/
  legacy/
results/
tests/
```

Durante a migracao, manter os arquivos atuais na raiz ate que os services tenham
testes suficientes. So depois migrar chamadas de `run.py` e `run_quarter.py`.

## Produto Alvo

GoGraph Analytics:

- Dashboard geral.
- Canais e atribuicao.
- Diagnosticos e insights.
- Pontos de contato.
- Grafos reais de jornada.
- Caminhos, loops e segmentacoes.
- Historico de execucoes.
- Qualidade dos dados.
- Exportacoes.

GoGraph Sandbox:

- Canvas de caminhos com React Flow.
- Criacao e comparacao de cenarios.
- Analise historica de caminhos hipoteticos.
- Probabilidade do caminho, probabilidade de conversao, receita esperada,
  suporte historico, confianca e alertas.

## Sprints

### Sprint 0 - Auditoria e Estabilizacao

Objetivo: preservar o pipeline atual e preparar a base.

Tarefas:

- Confirmar arquivos atuais e entrypoints.
- Garantir `requirements.txt`.
- Garantir `.env.example`.
- Remover ou evitar credenciais hardcoded.
- Separar config sensivel de config analitico.
- Documentar como rodar localmente.
- Adicionar smoke tests para imports.
- Confirmar que Excel atual continua sendo gerado quando Metabase estiver configurado.

Criterio de aceite:

- Projeto atual continua funcionando.
- Nenhuma credencial versionada.
- Documentacao minima existe.
- Smoke imports passam.

Status: iniciado/concluido parcialmente. Falta validar `run.py` e `run_quarter.py`
com credenciais reais de Metabase.

### Sprint 1 - Refatoracao Do Motor Analitico

Objetivo: expor o motor atual por uma funcao Python unica, sem depender
exclusivamente dos scripts.

Criar incrementalmente:

- `gograph/backend/app/services/extraction_service.py`
- `gograph/backend/app/services/model_service.py`
- `gograph/backend/app/services/attribution_service.py`
- `gograph/backend/app/services/roas_service.py`
- `gograph/backend/app/services/insight_service.py`
- `gograph/backend/app/services/export_service.py`

Funcoes esperadas:

- `run_model(start_date, end_date, params)`
- `build_transition_counts(...)`
- `build_transition_matrix(...)`
- `compute_markov_attribution(...)`
- `compute_shapley_attribution(...)`
- `compute_channel_diagnostics(...)`
- `compute_roas(...)`
- `generate_recommendations(...)`

Objeto de resultado:

```text
ModelRunResult
  parameters
  transition_counts
  transition_matrix
  states
  markov_results
  shapley_results
  roas_results
  diagnostics
  top_paths
  data_quality
```

Criterio de aceite:

- O motor pode ser chamado por uma funcao Python unica.
- `run.py` e `run_quarter.py` continuam gerando Excel.
- O codigo novo tem testes de smoke ou unidade basicos.

Status: concluido na camada de service. Foram criados `ModelRunParams`,
`ModelRunResult`, `run_model(...)`, wrappers de extracao/atribuicao/ROAS/insight
e export Excel reutilizavel. Falta trocar `run.py` e `run_quarter.py` para usar
os services depois de comparar outputs com uma execucao real.

### Sprint 2 - Persistencia e Historico

Objetivo: salvar resultados em banco e consultar execucoes anteriores.

Tarefas:

- Configurar SQLAlchemy.
- Usar SQLite no MVP local, preparando URL para Postgres.
- Criar tabelas: `model_runs`, `transition_counts`, `transition_matrix`,
  `attribution_results`, `channel_diagnostics`, `path_summary`,
  `data_quality_checks`, `exports`.
- Persistir cada execucao com `model_run_id`.
- Ler resultados sem reprocessar.

Criterio de aceite:

- Cada execucao gera `model_run_id`.
- Resultados podem ser consultados depois.
- Excel vira output complementar, nao fonte principal.

Status: concluido para MVP local. Foram criados modelos SQLAlchemy, helpers de
engine/session, `create_db_and_tables(...)`, `save_model_run(...)`,
`list_model_runs(...)`, `get_model_run(...)`, `get_model_run_table(...)` e
`register_export(...)`. O default e SQLite via `DATABASE_URL=sqlite:///gograph.db`,
com contrato preparado para Postgres. Ainda falta Alembic/migrations formais.

### Sprint 3 - API Backend FastAPI

Objetivo: criar API para acionar modelos e alimentar o frontend.

Endpoints minimos:

- `POST /model-runs`
- `GET /model-runs`
- `GET /model-runs/{id}`
- `GET /model-runs/{id}/overview`
- `GET /model-runs/{id}/channels`
- `GET /model-runs/{id}/diagnostics`
- `GET /model-runs/{id}/transitions`
- `GET /model-runs/{id}/paths`
- `GET /model-runs/{id}/loops`
- `GET /model-runs/{id}/graph`
- `GET /model-runs/{id}/data-quality`
- `GET /model-runs/{id}/export`

Criterio de aceite:

- Uma execucao pode ser criada pela API.
- Resultados salvos podem ser consultados pela API.
- Erros retornam formato consistente.

Status: concluido para API MVP. A app FastAPI esta em
`gograph/backend/app/main.py`, com endpoints de model runs em
`gograph/backend/app/api/model_runs.py`. Testes usam SQLite temporario e
monkeypatch no `POST /model-runs` para evitar chamada real ao Metabase. Ainda
falta autenticação, paginação robusta e geração real de export a partir de rows
persistidas.

Nota de consolidacao/OOM: `run_model(...)` suporta `batch_mode`. O default
`auto` quebra a extracao de transicoes em meses quando o periodo passa de
`batch_days` dias, agregando transicoes localmente antes de rodar um unico
modelo. Isso replica a intencao do `run_quarter.py` dentro da API.

Nota de execucao longa: `POST /model-runs` agora cria um registro `pending` e
roda o modelo em background, evitando que o navegador fique preso em uma chamada
HTTP longa. O frontend faz polling ate `completed` ou `failed`.

### Sprint 4 - Dashboard Frontend MVP

Objetivo: mostrar model runs e principais KPIs sem depender do Excel.

Stack recomendada:

- React ou Next.js.
- Tabela simples para canais.
- Recharts, ECharts ou Plotly para graficos.
- Tailwind ou CSS simples.

Paginas:

- Home.
- Model Runs.
- Run Detail.
- Overview.
- Channels.
- Diagnostics.

Criterio de aceite:

- Usuario abre uma execucao e entende os principais resultados.
- Existem estados de loading, erro e vazio.

Status: concluido para frontend MVP. O app React/Vite esta em
`gograph/frontend`, consome a API FastAPI e implementa listagem/criacao de model
runs, overview, canais, diagnosticos e qualidade de dados. Falta adicionar
roteamento formal, testes frontend, export real pela UI e grafo visual.

### Sprint 5 - Insights e Pontos De Contato

Objetivo: enriquecer diagnostico de jornada.

Implementar:

- `first_touch_analysis`
- `middle_touch_analysis`
- `last_touch_analysis`
- `assist_analysis`
- `closer_analysis`
- `presence_analysis`
- `markov_shapley_conflict_analysis`
- `high_presence_low_value_analysis`
- `channel_role_classifier`
- `touchpoint_role_classifier`

Criterio de aceite:

- Sistema mostra canais iniciais, intermediarios e finais.
- Insights automaticos trazem evidencia numerica, confianca e limitacao.

Status: concluido para metrica baseada em transicoes agregadas. Foram criados
`compute_touchpoint_metrics(...)` e `generate_channel_insights(...)`, endpoints
`/insights` e `/touchpoints`, e abas frontend `Insights` e `Pontos`. Limite
conhecido: ainda nao e presenca real por jornada/usuario; isso depende da
Sprint 7 com paths completos persistidos.

### Sprint 6 - Grafos Reais De Jornada

Objetivo: expor jornadas observadas como grafo.

Backend:

- `GET /model-runs/{id}/graph`
- Calcular nodes, edges, probabilidades, contagens, receita e ticket medio.
- Calcular metricas com NetworkX: centralidade, PageRank, self loops e ciclos.

Frontend:

- Network graph.
- Filtro top N arestas.
- Tooltip de no e aresta.
- Highlight para `Conversion` e `Non-Conversion`.

Criterio de aceite:

- Usuario visualiza a jornada real como grafo.

Status: concluido para grafo observado a partir de transicoes persistidas. O
endpoint `/model-runs/{id}/graph` agora retorna nodes, edges, probabilidades,
contagens, receita, ticket medio, centralidade, PageRank, self-loops, ciclos e
summary. O frontend ganhou aba `Grafo` com visualizacao SVG, filtro top N de
arestas, tooltips e destaque visual para `Conversion` e `Non-Conversion`.
Limite conhecido: o grafo ainda representa transicoes agregadas; caminhos
completos por jornada entram na Sprint 7.

### Sprint 7 - Caminhos, Loops e Path Intelligence

Objetivo: analisar sequencias completas.

Implementar:

- `extract_top_paths`
- `compute_path_probability`
- `compute_path_revenue`
- `compute_path_avg_ticket`
- `detect_repeated_nodes`
- `detect_cycles`
- `rank_paths_by_conversion`
- `rank_paths_by_revenue`
- `rank_paths_by_dropoff`

Criterio de aceite:

- Sistema mostra top caminhos convertidos, nao convertidos, lucrativos e
  problematicos.
- Loops e ciclos sao identificados.

### Sprint 8 - Sandbox De Grafos

Objetivo: permitir desenhar caminhos e estimar metricas com base no historico.

Status: concluido. Backend com CRUD completo de cenarios e motor de analise de
paths em `gograph/backend/app/services/sandbox_service.py` e
`gograph/backend/app/api/sandbox.py`. Modelo `Scenario` persiste nodes, edges e
`path_channels` em SQLite. A analise computa `path_probability`,
`conversion_probability_given_last_node`, `composite_conversion_probability`
(path ate ultimo canal × P(eventualmente converter) via serie de potencia),
`expected_revenue`, `expected_ticket`, `historical_support`, `similar_paths`,
`warnings` e `confidence_score`. Frontend usa `@xyflow/react` em aba `Sandbox`:
paleta de canais conhecidos + canal hipotetico customizavel, canvas interativo
com nos e arestas, preview da sequencia, salvar/analisar cenarios, painel de
resultados. Todos os 12 testes do `tests/test_sandbox_service.py` passam.

Frontend:

- React Flow (@xyflow/react v12). ✓
- Adicionar, renomear e remover nos. ✓
- Conectar e remover arestas. ✓
- Selecionar canal existente. ✓
- Criar canal hipotetico (borda tracejada amarela). ✓
- Salvar e executar analise do cenario. ✓

Backend:

- `POST /sandbox/scenarios` ✓
- `GET /sandbox/scenarios` ✓
- `GET /sandbox/scenarios/{id}` ✓
- `PUT /sandbox/scenarios/{id}` ✓
- `DELETE /sandbox/scenarios/{id}` ✓
- `POST /sandbox/scenarios/{id}/analyze` ✓

Metricas implementadas:

- `path_probability` ✓
- `conversion_probability_given_last_node` ✓
- `composite_conversion_probability` ✓
- `expected_revenue` ✓
- `expected_ticket` ✓
- `historical_support` ✓
- `similar_paths` ✓
- `warnings` ✓
- `confidence_score` ✓

Criterio de aceite:

- Usuario desenha um caminho e recebe metricas esperadas. ✓

### Sprint 9 - Comparador De Cenarios

Objetivo: comparar jornadas hipoteticas entre si e contra baseline.

Status: concluido. Backend com endpoint `POST /sandbox/compare` em
`gograph/backend/app/api/sandbox.py` e logica de comparacao em
`gograph/backend/app/services/sandbox_service.py`. O servico aceita
1-N cenarios + flags `include_baseline` e `include_top_path`, retorna
`ScenarioCompareItem` por coluna com `winner_conversion/revenue/confidence`
e `ScenarioDelta` (B − A) quando exatamente 2 itens. O motor de analise
foi refatorado em `_analyze_path_channels` reutilizavel entre analise
individual e comparacao. Frontend ganhou modo "Comparar" com toggle no
sidebar, checkboxes de selecao, toggles de referencia (Baseline / Top
Caminho Real) e tabela side-by-side com celulas verdes para vencedor,
coluna de delta com positivo/negativo e alertas por item. 11 novos testes
em `tests/test_sandbox_service.py` (24 total, todos passando).

Comparacoes:

- Cenario A vs B. ✓
- Cenario vs baseline. ✓
- Cenario vs top caminho real. ✓

Criterio de aceite:

- Usuario compara probabilidade, conversao, receita esperada, suporte, confianca
  e alertas. ✓

### Sprint 10 - Segmentacao

Objetivo: analisar diferencas por dimensoes confiaveis.

Implementar:

- `infer_available_dimensions(df)`
- Filtros apenas para dimensoes existentes.
- `GET /model-runs/{id}/segments?dimension=...`
- Sinalizacao de baixa amostra.

Dimensoes candidatas:

- regiao, estado, cidade, pais, dispositivo, campanha, source, medium,
  `utm_source`, `utm_medium`, `acquisition_channel`, landing page, produto,
  categoria, novo vs recorrente, dia da semana, mes, canal inicial.

Criterio de aceite:

- Usuario ve metricas por segmento confiavel.
- ROAS segmentado so aparece quando spend tem granularidade compativel.

### Sprint 11 - Exportacoes e Relatorios

Objetivo: gerar outputs reutilizaveis para negocio.

Exports:

- Excel completo.
- CSV de canais.
- CSV de caminhos.
- JSON do grafo.
- Futuramente PDF ou PowerPoint executivo.

Abas Excel desejadas:

- Overview.
- Attribution & ROAS.
- Channel Diagnostics.
- Touchpoints.
- Insights.
- Top Paths.
- Loops.
- Segments.
- Converting Transitions.
- Non-Converting Transitions.
- Transition Matrix.
- Data Quality.

Criterio de aceite:

- Usuario baixa um relatorio completo pela UI/API.

### Sprint 12 - Testes, Performance e Deploy

Objetivo: preparar uso continuo.

Tarefas:

- Testes unitarios para Markov.
- Testes unitarios para Shapley.
- Testes para sandbox.
- Testes para path probability.
- Testes de API.
- Logging.
- Tratamento de erro.
- Dockerfile.
- `docker-compose` para backend, banco e frontend.
- Documentacao de deploy.

Criterio de aceite:

- Projeto sobe via `docker-compose`.
- Principais funcoes matematicas tem testes.
- Backend, frontend e banco sobem localmente.

## Ordem Recomendada

1. Proteger e modularizar o motor atual.
2. Criar persistencia.
3. Criar API.
4. Criar dashboard simples.
5. Criar metricas novas de insights, paths e touchpoints.
6. Criar grafo real.
7. Criar sandbox.
8. Criar segmentacoes.
9. Melhorar design.
10. Criar exports e testes.

## Modelo Matematico Que Deve Ser Preservado

- Jornadas iniciam em `(start)` e terminam em `Conversion` ou `Non-Conversion`.
- Contagens de transicao combinam convertidos e nao convertidos com
  `NON_CONV_SCALE`.
- A matriz de transicao e normalizada por linha.
- Probabilidade de conversao usa matriz fundamental de cadeia absorvente.
- Removal effect e a queda de `P(Conversion | start)` ao remover um canal.
- Atribuicao Markov normaliza removal effects positivos.
- Shapley usa Monte Carlo sobre contribuicoes marginais de coalizoes.
- Receita atribuida multiplica peso por receita total real.

- ROAS so e calculado quando existe spend confiavel por canal.
## Validacao Recomendada

Com dependencias instaladas:

```powershell
py -m pip install -r requirements.txt
py -m pytest -q
```

Smoke imports sem chamar Metabase:

```powershell
py -c "import config, extract, markov, roas, run, run_quarter; print('imports ok')"
```

Validacao de sintaxe:

```powershell
py -m compileall config.py extract.py markov.py roas.py run.py run_quarter.py tests
```

Validacao de ponta a ponta, somente com `.env` real configurado:

```powershell
py run.py
py run_quarter.py
```

## Riscos e Cuidados

- `run_quarter.py` tem datas trimestrais fixas em `Q_START` e `Q_END`.
- Identidade ainda mistura `user_pseudo_id` e `user_id` em alguns trechos.
- Spend de Meta pode estar agregado em Facebook enquanto Instagram aparece nas
  jornadas.
- `Direct` e `Other` podem representar tracking incompleto.
- Metabase/ClickHouse pode dar OOM em janelas grandes.
- Shapley pode ficar lento conforme o numero de canais cresce.

## Proxima Tarefa Recomendada

Comecar a Sprint 1 criando um service fino que chame as funcoes atuais sem mudar
o comportamento:

```text
gograph/backend/app/services/model_service.py
```

Esse service deve receber `start_date`, `end_date` e parametros, retornar um
`ModelRunResult` simples e ser usado primeiro por testes, antes de trocar
`run.py`.
