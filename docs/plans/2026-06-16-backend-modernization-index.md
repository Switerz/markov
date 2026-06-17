# Backend Modernization — Plan Index

Plano-mestre para transformar o backend MVP (`rows: list[dict[str, Any]]` + DataFrames em memória + SQLite) em uma camada tipada, auditável e Postgres-ready, conforme `docs/model-output-persistence-map.md`.

Cada bloco é um plano independente sob `docs/plans/`. Cada bloco termina com um portão de validação (testes + smoke check + verificação visual no frontend, quando aplicável) antes do próximo começar.

## Ordem de execução

| # | Bloco | Plano | Estado | Dependência |
|---|---|---|---|---|
| 0 | **Dockerizar** (backend + frontend + DB) | [block-0-dockerize.md](./2026-06-16-backend-block-0-dockerize.md) | rascunho | — |
| 1 | **Quick wins** (Pydantic strict + expose PFC/session_quality) | [block-1-quick-wins.md](./2026-06-16-backend-block-1-quick-wins.md) | rascunho | Block 0 |
| 2 | **Overview & Budget agregados** (`model_run_summary`, `channel_recommendations`, novos endpoints `/dashboard/*`) | [block-2-overview-budget.md](./2026-06-16-backend-block-2-overview-budget.md) | concluído | Block 1 |
| 3 | **Lineage & Audit** (`model_run_inputs`, `model_run_logs`, Trust Center real) | [block-3-lineage-audit.md](./2026-06-16-backend-block-3-lineage-audit.md) | concluído | Block 2 |
| 4 | **Sandbox real** (`scenarios` tipado + `scenario_graph` + `scenario_analysis` persistido) | [block-4-sandbox-real.md](./2026-06-16-backend-block-4-sandbox-real.md) | outline | Block 2 |
| 5 | **Schema refinement + Postgres** (`channel_metrics` consolidado, `transition_edges` normalizado, Alembic + Postgres) | [block-5-schema-postgres.md](./2026-06-16-backend-block-5-schema-postgres.md) | outline | Blocks 1–4 |

> Blocks 3 e 4 são paralelizáveis após Block 2. Block 5 é o último porque depende do schema final estar estável.

## Status de entrega

### Block 2 — Overview & Budget agregados

Concluído em `2026-06-16`.

Commits:
- `99cff68 feat(model): persist run summaries and channel recommendations`
- `f9b3599 feat(api): add overview and budget dashboard endpoints`
- `f430edc feat(frontend): consume dashboard overview and budget APIs`

Entregas:
- Tabelas persistidas `model_run_summary` e `channel_recommendations`.
- Services `summary_service` e `recommendation_service`.
- Endpoints `GET /model-runs/{id}/summary`, `GET /model-runs/{id}/recommendations`, `GET /model-runs/{id}/dashboard/overview`, `GET /model-runs/{id}/dashboard/budget`.
- `compare_run_id` validado server-side e retornando deltas no Overview.
- Overview e Decisões de Budget consumindo endpoints reais com fallback para mock.

Validação executada:
- Backend: `.venv/bin/pytest -q` → `117 passed`
- Frontend: `npm test -- --run` → `161 passed`
- Frontend build: `npm run build` → OK

Observação:
- Alembic/Postgres não fazem parte do Block 2; continuam previstos para Block 5.

### Block 3 — Lineage & Audit

Concluído em `2026-06-17`.

Commits:
- `7c09703 feat(model): add lineage inputs and structured run logs`
- `4f3eaaa feat(api): expose model run inputs and logs`
- `55e01b6 feat(executions): show real trust center inputs and logs`

Entregas:
- Tabelas persistidas `model_run_inputs` e `model_run_logs`.
- Helper `canonical_hash` para hash SHA-256 canônico de DataFrames.
- Captura de lineage em `extraction_service`.
- Logs estruturados para `extraction`, `markov`, `shapley`, `roas`, `recommendation` e `persistence`.
- Falhas de step gravam log `failed` antes de propagar exception.
- Endpoints `GET /model-runs/{id}/inputs` e `GET /model-runs/{id}/logs`.
- `data_quality_checks` expandido com `score`, `affected_rows` e `recommendation`.
- Trust Center e painel de detalhes em `/execucoes-e-qualidade` consumindo `summary`, `inputs`, `logs` e `data-quality`.

Validação executada:
- Backend: `.venv/bin/pytest -q` → `122 passed`
- Frontend: `npm test -- --run` → `161 passed`
- Frontend build: `npm run build` → OK

## Decisões já tomadas (registradas para não rediscutir)

- **`account_id` adiado.** Coluna nullable em `model_runs` desde Block 2 (custo zero adicionar), sem middleware/RLS/scoping até multi-tenant virar requisito. Documentado como TODO.
- **SQLite mantido** durante Blocks 0–4. Alembic introduzido em Block 5 com migração inicial alinhada ao schema corrente; Postgres é flip de `DATABASE_URL`.
- **`scenario_analysis` persistido com `model_run_id` + `code_version`.** Não é cache silencioso — o frontend mostra "calculado com versão X" quando o run foi reprocessado depois.
- **`data_hash` em `model_run_inputs`** = SHA-256 do DataFrame extraído após ordenação canônica por `user_id, timestamp` (para reproducibilidade real, não apenas bytes brutos).
- **Versionamento no payload de cada endpoint agregado:** `meta: { model_version, code_version, generated_at }`. Sem isso, dashboard cacheado fica indistinguível de recalculado.
- **`compare_run_id` validado server-side:** run inexistente ou de período não-comparável retorna `422` com explicação, não `500`.
- **Backward-compat dos endpoints `TableResponse`:** mantidos até o frontend migrar (Block 5 derruba).

## Padrão por bloco

Cada plano `.md` segue:

1. **Header** (Goal / Architecture / Tech Stack / Premissas / Gate de pronto).
2. **Tasks** em fases. Cada task = arquivo(s) exato + step 1..N de 2–5 min cada.
3. **Validation gate** ao final de cada fase — `pytest` + curl no endpoint + (quando aplica) recarregar frontend e verificar comportamento.
4. **Critérios de aceite** explícitos antes de marcar bloco como pronto.

## Stack alvo

- **Backend:** Python 3.12 + FastAPI + SQLAlchemy 2.x + Pydantic 2.x + Alembic (Block 5) + Postgres 16 (Block 5) — hoje SQLite.
- **Containers:** Docker + docker-compose (Block 0). Profiles `dev` (uvicorn `--reload` + vite dev) e `prod` (uvicorn + nginx-served static).
- **Frontend:** sem mudanças de stack — apenas swap de mocks por endpoints reais à medida que cada bloco entrega.
- **CI/CD:** fora do escopo destes blocks; um Block 6 opcional pode tratar GitHub Actions + deploy.

## Como executar cada bloco

Cada plano tem um header:
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

Recomendação:
- **Auto-execução em série:** `Workflow` orquestrando `executing-plans` por bloco em ordem.
- **Subagent-driven em sessão:** `superpowers:subagent-driven-development` com 1 subagent por bloco, review entre blocks.
- **Manual:** abrir o `.md`, seguir tasks 1 por 1.

## Métricas de sucesso

Ao terminar os 6 blocos:
- 0 ocorrências de `dict[str, Any]` em respostas de endpoints.
- 100% das telas do frontend consomem endpoints tipados (zero `TODO(api):` ativo em hooks).
- `docker compose up` traz o stack inteiro online em <60s.
- `pytest` em <30s; cobertura mínima de 70% nos services novos.
- Cada execução do modelo é totalmente reproduzível a partir de `model_run_inputs.data_hash` + `parameters_json`.
- `compare_run_id` funciona em Overview, Budget, Channel 360 e Execuções.
