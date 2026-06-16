# GoGraph - Mapa de outputs, persistencia e contrato de telas

Este documento mapeia os outputs do motor de atribuicao, os dados que precisam
ser persistidos e os contratos necessarios para que o frontend deixe de depender
de mocks.

## Objetivo

Cada execucao do modelo deve virar um snapshot analitico completo, auditavel e
comparavel com execucoes anteriores. O frontend deve consumir dados derivados de
uma execucao (`model_run_id`) e, quando aplicavel, de uma execucao de comparacao
(`compare_run_id`).

## Outputs atuais do motor

O contrato central esta em `gograph/backend/app/schemas/model_run.py`:

- `parameters`: periodo, lookback, decay, amostragem, batch e censura.
- `transition_counts`: transicoes convertidas e nao convertidas.
- `transition_matrix`: matriz de probabilidades Markov.
- `states`: estados/canais do modelo.
- `markov_results`: pesos, receita e removal effect.
- `shapley_results`: pesos e receita Shapley.
- `roas_results`: canal, spend, receita atribuida, ROAS e recomendacao.
- `diagnostics`: papel do canal, presenca e posicao first/middle/last touch.
- `top_paths`: caminhos, frequencia, conversao, receita, ticket e loops.
- `data_quality`: checks de qualidade.
- `loop_diagnostics`: diagnosticos de auto-loop por canal.
- `funnel_state_attribution`: atribuicao por canal + etapa de funil.
- `sequential_effects`: pares de canais e lift sequencial.
- `summary`: receita total, spend total, conversao observada/modelada e runtime.

## Lacuna atual

Hoje o backend salva parte desses outputs, mas ainda com formato de MVP:

- Algumas respostas sao `rows: list[dict[str, Any]]`, sem schema especifico.
- Varios endpoints carregam a tabela inteira em `DataFrame` e filtram em memoria.
- Faltam entidades de conta, fonte de dados, snapshot de input, versao do modelo e
  lineage.
- Campos que a UI usa para recomendacao, impacto estimado e comparacao ainda
  existem so em mocks ou sao derivados de forma incompleta.

## Tabelas propostas

### 1. `model_runs`

Execucao principal do modelo.

Campos:

- `id`
- `account_id`
- `period_start`
- `period_end`
- `compare_run_id`
- `status`: `pending`, `running`, `completed`, `failed`
- `created_at`
- `started_at`
- `finished_at`
- `created_by`
- `model_version`
- `code_version`
- `funnel_model_active`
- `parameters_json`
- `input_snapshot_id`
- `runtime_seconds`
- `error_message`

Uso:

- Execucoes & Qualidade
- Top bars de todas as telas
- Comparacao entre periodos

### 2. `model_run_logs`

Linha do tempo operacional de uma execucao.

Campos:

- `id`
- `model_run_id`
- `step`: `extraction`, `markov`, `shapley`, `roas`, `persistence`
- `status`
- `message`
- `duration_seconds`
- `created_at`

Uso:

- Aba "Logs" em Execucoes & Qualidade
- Auditoria e debugging

### 3. `model_run_inputs`

Lineage dos dados usados na execucao.

Campos:

- `id`
- `model_run_id`
- `source`: `plausible`, `datamart`, `events_v2`, `spend`
- `database_id`
- `query_name`
- `row_count`
- `date_min`
- `date_max`
- `data_hash`
- `extracted_at`

Uso:

- Aba "Entradas"
- Trust Center
- Auditoria de reproducibilidade

### 4. `model_run_summary`

KPIs agregados da execucao.

Campos:

- `model_run_id`
- `observed_conversion_rate`
- `model_conversion_rate`
- `total_revenue`
- `total_spend`
- `total_conversions`
- `total_nonconversions_sampled`
- `non_conv_scale`
- `state_count`
- `channel_count`
- `path_count`
- `transition_count`
- `confidence_score`
- `confidence_label`

Uso:

- Visao Geral
- Execucoes & Qualidade
- Comparacao de execucoes

### 5. `channel_metrics`

Tabela central por canal e execucao.

Campos:

- `model_run_id`
- `channel`
- `spend`
- `spend_share`
- `markov_weight`
- `markov_revenue`
- `markov_revenue_share`
- `removal_effect`
- `shapley_weight`
- `shapley_revenue`
- `shapley_revenue_share`
- `roas_markov`
- `roas_shapley`
- `first_click_revenue`
- `last_click_revenue`
- `first_click_roas`
- `last_click_roas`
- `consensus_score`
- `confidence_score`
- `recommendation`
- `recommendation_tone`
- `channel_role`
- `touchpoint_role`
- `presence_converting`
- `presence_nonconverting`
- `first_touch_share`
- `middle_touch_share`
- `last_touch_share`
- `starter_count`
- `assist_count`
- `closer_count`
- `dropoff_after_touch`

Uso:

- Visao Geral
- Decisoes de Budget
- Canal 360
- Experimentos

### 6. `channel_recommendations`

Recomendacoes acionaveis por canal.

Campos:

- `model_run_id`
- `channel`
- `recommendation`: `Escalar`, `Defender`, `Investigar`, `Reduzir`
- `priority_rank`
- `rationale_json`
- `risks_json`
- `best_practices_json`
- `suggested_budget_delta_pct`
- `suggested_budget_delta_value`
- `estimated_revenue_delta`
- `estimated_roas_min`
- `estimated_roas_max`
- `saturation_score`
- `confidence_score`

Uso:

- Cards de decisoes prioritarias
- Drawer de canal
- Oportunidades e riscos
- Cenarios sugeridos

### 7. `transition_edges`

Grafo e matriz de jornada em formato consultavel.

Campos:

- `model_run_id`
- `from_state`
- `to_state`
- `transition_type`
- `count`
- `probability`
- `revenue`
- `avg_ticket`
- `is_self_loop`

Uso:

- Sankey
- Graph view
- Matriz de transicao
- Canal 360: canais antes/depois
- Sandbox

### 8. `path_metrics`

Metricas por caminho/jornada.

Campos:

- `model_run_id`
- `path_hash`
- `path_text`
- `path_channels_json`
- `path_length`
- `count`
- `conversion_count`
- `nonconversion_count`
- `conversion_rate`
- `path_probability`
- `revenue`
- `avg_ticket`
- `time_to_conversion_avg`
- `contains_loop`
- `confidence_score`

Uso:

- Top paths
- Jornada
- Sequencias relevantes no Canal 360
- Sandbox
- Experimentos

### 9. `funnel_stage_metrics`

Atribuicao por canal e etapa de funil.

Campos:

- `model_run_id`
- `state`
- `channel`
- `funnel_stage`
- `markov_weight`
- `markov_revenue`
- `removal_effect`
- `shapley_weight`
- `shapley_revenue`
- `presence_converting`
- `presence_nonconverting`
- `support`
- `confidence`

Uso:

- Canal 360
- Validacao do Funnel Stage Markov
- Diagnostico de low intent drag

### 10. `loop_diagnostics`

Diagnosticos de auto-loop por canal.

Campos:

- `model_run_id`
- `channel`
- `self_loop_count`
- `self_loop_rate`
- `avg_consecutive_repeats`
- `median_consecutive_repeats`
- `max_consecutive_repeats`
- `loop_conversion_rate`
- `nonloop_conversion_rate`
- `loop_conversion_lift`
- `exit_distribution_json`
- `support`
- `confidence`

Uso:

- Jornada: loops e padroes
- Canal 360: riscos e sequencias

### 11. `sequential_effects`

Efeitos de ordem entre canais.

Campos:

- `model_run_id`
- `previous_channel`
- `current_channel`
- `pair_count`
- `conversion_count`
- `nonconversion_count`
- `conversion_probability_pair`
- `conversion_probability_baseline`
- `lift_vs_baseline`
- `avg_ticket`
- `revenue`
- `support`
- `confidence`
- `diagnostic_label`

Uso:

- Canal 360: canais antes/depois
- Jornada: padroes
- Experimentos: impacto de sequencias

### 12. `data_quality_checks`

Checks de qualidade com score e recomendacao.

Campos:

- `model_run_id`
- `check_name`
- `status`
- `severity`
- `score`
- `detail`
- `affected_rows`
- `recommendation`

Uso:

- Trust Center
- Execucoes & Qualidade
- Alertas tecnicos

### 13. `scenarios`

Definicao de cenario do sandbox/experimentos.

Campos:

- `id`
- `model_run_id`
- `name`
- `description`
- `action_type`: `removeChannel`, `reducePresence`, `redistributeBudget`, `compareModels`
- `channel`
- `intensity_pct`
- `period_start`
- `period_end`
- `created_at`
- `updated_at`

### 14. `scenario_graph`

Grafo salvo para o cenario.

Campos:

- `scenario_id`
- `nodes_json`
- `edges_json`
- `path_channels_json`

### 15. `scenario_analysis`

Resultado calculado de um cenario.

Campos:

- `scenario_id`
- `path_probability`
- `conversion_probability_given_last_node`
- `composite_conversion_probability`
- `historical_conversion_rate`
- `lift`
- `expected_revenue`
- `expected_ticket`
- `historical_support`
- `confidence_score`
- `warnings_json`
- `similar_paths_json`

Uso:

- Experimentos
- Journey path builder
- Comparacao baseline vs cenario

## Dependencias por tela

### Visao Geral

Precisa de:

- `model_run_summary`
- `channel_metrics`
- `channel_recommendations`
- `path_metrics`
- `transition_edges`
- `data_quality_checks`
- `compare_run_id` para deltas

### Decisoes de Budget

Precisa de:

- `channel_metrics`
- `channel_recommendations`
- `transition_edges`
- `sequential_effects`
- `path_metrics`
- comparacao contra execucao anterior

### Canal 360

Precisa de:

- `channel_metrics`
- `channel_recommendations`
- `funnel_stage_metrics`
- `transition_edges`
- `sequential_effects`
- `path_metrics`
- historico de `channel_metrics` em execucoes anteriores

### Jornadas

Precisa de:

- `transition_edges`
- `transition_matrix`
- `path_metrics`
- `loop_diagnostics`
- `sequential_effects`
- `scenarios`

### Experimentos

Precisa de:

- `scenarios`
- `scenario_graph`
- `scenario_analysis`
- `channel_metrics`
- `transition_edges`
- `path_metrics`

### Execucoes & Qualidade

Precisa de:

- `model_runs`
- `model_run_summary`
- `model_run_inputs`
- `model_run_logs`
- `data_quality_checks`
- `exports`

## Endpoints alvo

### Execucoes

- `GET /model-runs`
- `POST /model-runs`
- `GET /model-runs/{id}`
- `GET /model-runs/{id}/summary`
- `GET /model-runs/{id}/logs`
- `GET /model-runs/{id}/inputs`
- `GET /model-runs/{id}/quality`

### Overview

- `GET /model-runs/{id}/dashboard/overview?compare_run_id=...`

Resposta deve agregar KPIs, decisoes prioritarias, consenso dos modelos,
resumo da jornada e confianca.

### Budget

- `GET /model-runs/{id}/dashboard/budget?compare_run_id=...`
- `GET /model-runs/{id}/channels`
- `GET /model-runs/{id}/channels/{channel}`

### Canal 360

- `GET /model-runs/{id}/channels/{channel}/360?compare_run_id=...`
- `GET /model-runs/{id}/channels/{channel}/transitions`
- `GET /model-runs/{id}/channels/{channel}/sequences`
- `GET /model-runs/{id}/channels/{channel}/history`

### Jornadas

- `GET /model-runs/{id}/journeys/flow`
- `GET /model-runs/{id}/journeys/graph`
- `GET /model-runs/{id}/journeys/paths`
- `GET /model-runs/{id}/journeys/matrix`
- `GET /model-runs/{id}/journeys/loops`

Todos devem suportar filtros e paginacao quando retornarem listas.

### Experimentos

- `GET /model-runs/{id}/scenarios`
- `POST /model-runs/{id}/scenarios`
- `POST /scenarios/{id}/analyze`
- `POST /model-runs/{id}/scenarios/compare`

## Ordem recomendada de implementacao

1. Adicionar Alembic e migrar schema para Postgres.
2. Criar `model_run_summary`, `model_run_inputs` e `model_run_logs`.
3. Consolidar `channel_metrics` e `channel_recommendations`.
4. Trocar endpoints de tabela por consultas SQL paginadas e tipadas.
5. Criar endpoints agregados para Overview e Budget.
6. Normalizar `transition_edges` e `path_metrics` para Jornadas e Sandbox.
7. Persistir `scenario_analysis` para Experimentos.
8. Remover dependencias de mocks do frontend, tela por tela.

## Criterio de pronto

Uma tela so deve ser considerada 100% funcional quando:

- Todos os dados visiveis vêm de endpoint tipado.
- A tela aceita `model_run_id` ativo e `compare_run_id` quando houver delta.
- Listas grandes têm paginacao/filtros no SQL.
- O endpoint retorna estados de vazio, loading e erro previsiveis.
- Os campos usados no frontend existem em schema Pydantic dedicado.
- A execucao pode ser auditada por inputs, parametros, logs e qualidade.

