# Block 5 — Schema consolidation + Postgres + Alembic

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidar `channel_metrics` (mescla `AttributionResult` + `ChannelDiagnostic`), normalizar `transition_edges` (mescla `TransitionCount` + `TransitionMatrixEntry`), introduzir Alembic + migrar para Postgres como DB padrão (`DATABASE_URL=postgresql://...`), e remover endpoints legacy `TableResponse` (já substituídos pelos agregados em Blocks 2–4).

**Architecture:**
- **`channel_metrics`** vira a tabela canônica por canal/execução, agregando o que hoje está espalhado em `AttributionResult` (markov/shapley/roas) + `ChannelDiagnostic` (presença, role, posição). Os modelos antigos viram views ou são removidos quando o frontend não os usar mais.
- **`transition_edges`** com colunas `from_state`, `to_state`, `transition_type` (converting|nonconverting|matrix), `count`, `probability`, `revenue`, `avg_ticket`, `is_self_loop`. Substitui `TransitionCount` + `TransitionMatrixEntry` numa tabela unificada com índices apropriados.
- **Alembic** + **Postgres**: migration baseline reproduz o schema corrente; migrations subsequentes implementam as consolidações. Postgres habilitado por `docker compose --profile pg`.
- Paginação **SQL** (LIMIT/OFFSET com cursor opcional) em todos os endpoints que retornam listas grandes (`/paths`, `/loops`, `/transition_edges`, `/sequential-effects`).

**Premissas:**
- Blocks 0–4 entregues.
- Dados em produção (se houver) precisam de migration formal — aqui assumimos dev/staging. Para produção, documentar como rodar `alembic upgrade head` com backup.
- Endpoints `/channels`, `/diagnostics`, `/transitions`, `/paths` continuam compatíveis por 1 release após consolidação — internamente leem de `channel_metrics` / `transition_edges`.

**Gate de pronto:**
- `alembic upgrade head` aplica todas as migrations num DB Postgres limpo sem erro.
- `docker compose --profile pg up` traz Postgres + backend + frontend funcionando.
- `pytest` passa contra Postgres (config via `DATABASE_URL`).
- Frontend funciona sem regressão em todas as 6 telas.
- Paginação SQL substitui filtragem em memória nos endpoints grandes.
- Endpoints legacy estão deprecados (marcados com `deprecated=True` no decorator FastAPI) ou removidos.

---

## Phase 5.A — Alembic baseline

### Task 5.A.1 — Instalar + configurar Alembic

- Adicionar `alembic>=1.13` em `requirements.txt`.
- `alembic init alembic` na raiz do repo.
- Configurar `alembic.ini` + `alembic/env.py` para ler `DATABASE_URL` do env e importar `Base.metadata` de `gograph.backend.app.db.models`.

Commit: `chore(db): alembic scaffold`.

### Task 5.A.2 — Migration baseline (espelha schema atual)

- `alembic revision --autogenerate -m "baseline"` num DB limpo.
- Auditar a migration gerada: garantir que ela bate com `db/models.py` atual (todas as 17 tabelas após Blocks 0–4).
- Aplicar em DB SQLite local: `alembic upgrade head`. Verificar tabelas via `sqlite3 gograph.db ".tables"`.

Commit: `feat(db): alembic baseline migration`.

---

## Phase 5.B — Consolidate `channel_metrics`

### Task 5.B.1 — Nova tabela `channel_metrics`

Migration cria `channel_metrics` com TODOS os campos do doc `model-output-persistence-map.md`. Backfill: insert select de `AttributionResult` + `ChannelDiagnostic` join por `(model_run_id, channel)`.

Commit: `feat(db): channel_metrics consolidated table + backfill`.

### Task 5.B.2 — Services apontam para `channel_metrics`

Refactor `persistence_service` para gravar `channel_metrics` em vez de `AttributionResult` + `ChannelDiagnostic`. Endpoints `/channels` e `/diagnostics` passam a ler de `channel_metrics`.

Commit: `feat(channels): read/write via channel_metrics`.

### Task 5.B.3 — Deprecar `AttributionResult` + `ChannelDiagnostic`

Após o frontend migrado, dropar tabelas via migration. Aviso de 1 release antes de remover endpoints legacy.

Commit: `chore(db): drop AttributionResult + ChannelDiagnostic`.

---

## Phase 5.C — Normalize `transition_edges`

### Task 5.C.1 — Nova tabela + backfill

`transition_edges` com colunas e índices `(model_run_id, from_state)`, `(model_run_id, to_state)`. Backfill de `TransitionCount` (`transition_type="converting"|"nonconverting"`) + `TransitionMatrixEntry` (`transition_type="matrix"`).

Commit: `feat(db): transition_edges normalized table + backfill`.

### Task 5.C.2 — Endpoints + frontend

`/transitions` lê de `transition_edges`. Sankey, Graph, Matriz no /jornadas consomem a mesma tabela com filtros por `transition_type`.

Commit: `feat(journeys): transition_edges powers sankey/graph/matrix`.

---

## Phase 5.D — Paginação SQL

### Task 5.D.1 — Adicionar `limit`/`offset` em endpoints lista

`/paths`, `/loops`, `/transitions`, `/sequential-effects`. Default `limit=100`, max `500`. Response inclui `total_count` para o frontend renderizar paginação.

Commit: `feat(api): SQL pagination for large list endpoints`.

### Task 5.D.2 — Frontend usa paginação

DataTable já suporta `pageSize`; agora controlado por URL ou estado e dispara refetch quando muda. Atualizar hooks `usePaths`, `useTopPaths`, etc.

Commit: `feat(tables): server-driven pagination`.

---

## Phase 5.E — Postgres

### Task 5.E.1 — Habilitar profile `pg`

`docker compose --profile dev --profile pg up` traz Postgres. Verificar conectividade via `psql -h localhost -U gograph -d gograph -c "\dt"`.

### Task 5.E.2 — Switch `DATABASE_URL`

`.env` local pode usar `DATABASE_URL=postgresql+psycopg2://gograph:gograph@db:5432/gograph` quando rodando via compose. Quando rodando nativo via `./dev.sh`, defaults para SQLite.

Adicionar `psycopg2-binary>=2.9` em `requirements.txt`.

Commit: `feat(db): postgres-compatible config via DATABASE_URL`.

### Task 5.E.3 — `alembic upgrade head` em Postgres

Rodar contra DB Postgres fresco. Validar todas as tabelas criadas. Rodar `python run.py` (com Metabase config) e checar inserts.

Commit (sem código novo, só validação) — não commitar.

### Task 5.E.4 — CI/test contra Postgres

`pytest` ganha fixture `postgres_session` que sobe um DB efêmero (ou usa `pytest-postgresql`). Marcar tests que requerem PG como `@pytest.mark.pg`. Documentar em `docs/testing.md`.

Commit: `test(db): pytest fixtures for postgres + tagged tests`.

---

## Phase 5.F — Cleanup endpoints legacy

### Task 5.F.1 — Marcar legacy endpoints como deprecated

```python
@router.get("/{model_run_id}/channels", response_model=..., deprecated=True)
```

Adicionar header `Deprecation` na resposta. Documentar no Swagger `/docs`.

Commit: `chore(api): mark TableResponse legacy endpoints deprecated`.

### Task 5.F.2 — Remover endpoints após verificação

Após o frontend não os chamar mais (verificar via grep no `lib/api.ts`), deletar handlers. Manter um lag de 1 release entre marcar deprecated e remover.

Commit: `chore(api): remove deprecated TableResponse endpoints`.

---

## Validation gate

- [ ] `alembic upgrade head` num DB Postgres limpo aplica todas migrations sem erro.
- [ ] `docker compose --profile dev --profile pg up` traz tudo online.
- [ ] `pytest` (config para apontar para Postgres no CI) passa.
- [ ] `python run.py` apontando para Postgres roda end-to-end e produz `channel_metrics`, `transition_edges`, etc.
- [ ] Frontend funciona sem regressão (6 telas verificadas).
- [ ] Paginação SQL nos endpoints grandes — sem `DataFrame.read_sql + filter` em código.
- [ ] Endpoints legacy marcados deprecated ou removidos.

## Critérios de aceite

- 0 dependência de SQLite em prod (config sempre Postgres).
- 0 tabela duplicada (`AttributionResult` + `ChannelDiagnostic` removidas; `TransitionCount` + `TransitionMatrixEntry` removidas — substituídas por `channel_metrics` + `transition_edges`).
- Schema final bate 1-para-1 com o doc `model-output-persistence-map.md`.
- Cada migration tem `upgrade` e `downgrade` testados (`alembic downgrade -1` funcional).

---

## Out of scope

- Schema migration em produção com dados reais — runbook separado.
- Sharding / read replicas — fora do escopo.
- Search engine (e.g. para filtros free-text em `path_text`) — Block 6.
- Materialized views — Block 6 se performance demandar.
