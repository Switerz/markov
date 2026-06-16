# Block 3 — Lineage & Audit (`model_run_inputs`, `model_run_logs`)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cada execução do modelo passa a deixar rastros auditáveis: (1) **lineage** dos dados que entraram (queries, datasource, period, hash) e (2) **logs estruturados** dos passos do pipeline (extração, markov, shapley, roas, persistence). Trust Center e abas "Entradas"/"Logs" da tela `/execucoes-e-qualidade` deixam de ser mocks.

**Architecture:**
- **Tabela `model_run_inputs`:** uma row por fonte+query usada na execução. Capturada em `extraction_service` quando cada query Metabase termina. Inclui `data_hash = SHA-256` do DataFrame extraído após ordenação canônica (`user_id`, `timestamp`) para reproducibilidade real.
- **Tabela `model_run_logs`:** uma row por passo do pipeline. Inserida com `started_at`/`finished_at` por step. Em caso de erro: status `failed` + `message` capturado.
- **Decorator `@logged_step("extraction")`** envolve cada step crítico para automatizar log insertion.
- Endpoints novos: `GET /model-runs/{id}/inputs`, `GET /model-runs/{id}/logs`.
- Trust Center (`/execucoes-e-qualidade`) consome `/inputs`, `/logs`, `/data-quality` (já existe), e `/summary` (Block 2).

**Tech Stack:** sem novas deps. `hashlib` (stdlib) para o SHA-256; `contextlib` para o decorator.

**Premissas:**
- Block 2 entregue (`model_run_summary` existe).
- Hash usa o DataFrame **após** ordenar por `user_id`, `timestamp`, normalizar dtypes e dropar índices. Documentar exatamente a ordem em `services/extraction_service.py`.
- Logs são gravados de forma síncrona (não async/background) para garantir que falhas durante o pipeline sempre deixem o log final.

**Gate de pronto:**
- Rodar `python run.py` produz N rows em `model_run_inputs` e M rows em `model_run_logs`.
- `GET /model-runs/{id}/inputs` retorna fontes + counts + hashes.
- `GET /model-runs/{id}/logs` retorna timeline ordenada por `created_at`.
- Trust Center no frontend mostra dados reais (cobertura de eventos vem de `data-quality` + `inputs`).
- Aba "Logs" no painel de Execuções renderiza a timeline real.

---

## Phase 3.A — Schema

### Task 3.A.1 — Modelos `ModelRunInput` + `ModelRunLog`

**Files:** modify `gograph/backend/app/db/models.py`

```python
class ModelRunInput(Base):
    __tablename__ = "model_run_inputs"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id", ondelete="CASCADE"))
    source: Mapped[str]              # plausible | datamart | events_v2 | spend
    database_id: Mapped[Optional[int]]
    query_name: Mapped[str]
    row_count: Mapped[int]
    date_min: Mapped[Optional[str]]  # YYYY-MM-DD
    date_max: Mapped[Optional[str]]
    data_hash: Mapped[str]            # sha256 hex
    extracted_at: Mapped[datetime]


class ModelRunLog(Base):
    __tablename__ = "model_run_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id", ondelete="CASCADE"))
    step: Mapped[str]                 # extraction | markov | shapley | roas | recommendation | persistence
    status: Mapped[str]               # started | success | failed
    message: Mapped[Optional[str]]
    duration_seconds: Mapped[Optional[float]]
    created_at: Mapped[datetime]
```

Commit: `feat(db): model_run_inputs + model_run_logs tables`

### Task 3.A.2 — Pydantic row schemas

`ModelRunInputRow`, `ModelRunLogRow` em `row_schemas.py`. Commit: `feat(api): inputs + logs row schemas`.

---

## Phase 3.B — `data_hash` helper

### Task 3.B.1 — `services/lineage_service.py`

```python
import hashlib
import pandas as pd

def canonical_hash(df: pd.DataFrame, sort_by: list[str] | None = None) -> str:
    """
    SHA-256 of a canonical representation of a DataFrame.
    Canonical = sorted by `sort_by` (default: all columns), dtypes normalized to str, reset_index.
    """
    sort_cols = sort_by or list(df.columns)
    sort_cols = [c for c in sort_cols if c in df.columns]
    canon = df.sort_values(sort_cols).reset_index(drop=True)
    payload = canon.to_csv(index=False).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()
```

Test:
```python
def test_canonical_hash_stable_across_order():
    df1 = pd.DataFrame({"a": [3, 1, 2], "b": ["x", "y", "z"]})
    df2 = df1.iloc[[2, 0, 1]].reset_index(drop=True)
    assert canonical_hash(df1, sort_by=["a"]) == canonical_hash(df2, sort_by=["a"])

def test_canonical_hash_changes_with_data():
    df1 = pd.DataFrame({"a": [1], "b": ["x"]})
    df2 = pd.DataFrame({"a": [1], "b": ["y"]})
    assert canonical_hash(df1) != canonical_hash(df2)
```

Commit: `feat(lineage): canonical_hash helper for reproducibility`.

---

## Phase 3.C — Capturar inputs em `extraction_service`

### Task 3.C.1 — Plumbar `model_run_id` para o extraction

Hoje `extract.py` é stateless. Vamos manter assim e fazer o wrapper em `services/extraction_service.py` capturar a metadata pós-fetch.

Padrão:
```python
def fetch_converting_transitions(params, model_run_id: int, session: Session) -> pd.DataFrame:
    df = get_converting_transitions(database_id=..., start_date=..., end_date=...)
    record_input(
        session,
        model_run_id=model_run_id,
        source="plausible",
        database_id=params.db_plausible,
        query_name="converting_transitions",
        df=df,
        date_range=(params.start_date, params.end_date),
    )
    return df
```

`record_input` calcula hash + insere row em `model_run_inputs`.

Commit: `feat(extraction): record lineage rows per fetched dataset`.

### Task 3.C.2 — Test

Mock `get_converting_transitions` para retornar DataFrame conhecido, rodar wrapper, validar que row foi inserida com hash esperado.

Commit: `test(extraction): lineage row written per fetch`.

---

## Phase 3.D — Decorator `@logged_step`

### Task 3.D.1 — `services/log_service.py`

```python
import time
import functools
from datetime import datetime

def logged_step(step_name: str):
    def deco(fn):
        @functools.wraps(fn)
        def wrapper(session, model_run_id, *args, **kwargs):
            start = time.time()
            insert_log(session, model_run_id, step_name, "started")
            try:
                result = fn(session, model_run_id, *args, **kwargs)
                insert_log(
                    session, model_run_id, step_name, "success",
                    duration_seconds=time.time() - start,
                )
                return result
            except Exception as e:
                insert_log(
                    session, model_run_id, step_name, "failed",
                    message=str(e), duration_seconds=time.time() - start,
                )
                raise
        return wrapper
    return deco
```

`insert_log` faz `session.add(ModelRunLog(...))` + `session.commit()` (commit dentro do log para sobreviver a falhas no step).

Aplicar em `model_service.run_model` envolvendo:
- `@logged_step("extraction")` → na função que chama as extrações.
- `@logged_step("markov")` → na função que calcula Markov.
- `@logged_step("shapley")`, `@logged_step("roas")`, `@logged_step("recommendation")`, `@logged_step("persistence")`.

Commit: `feat(log): @logged_step decorator + apply on pipeline steps`.

---

## Phase 3.E — Endpoints

### Task 3.E.1 — `GET /model-runs/{id}/inputs`

```python
@router.get("/{model_run_id}/inputs", response_model=list[ModelRunInputRow])
def get_inputs(...): ...
```

Commit: `feat(api): GET /model-runs/{id}/inputs`.

### Task 3.E.2 — `GET /model-runs/{id}/logs`

Mesmo padrão; ordenado por `created_at` asc.

Commit: `feat(api): GET /model-runs/{id}/logs`.

### Task 3.E.3 — Estender `/data-quality` com `score` + `affected_rows` + `recommendation`

`data_quality_checks` ganha colunas (Block 1 deixou nullable). Service que produz checks preenche.

Commit: `feat(quality): expand data_quality_checks with score/affected_rows/recommendation`.

---

## Phase 3.F — Frontend: Trust Center real

### Task 3.F.1 — Hook `useExecutionsQualityData(runId)`

Compõe a partir de:
- `api.getOverview(runId)` (Block 0/1 — basic info)
- `api.getSummary(runId)` (Block 2)
- `api.getInputs(runId)` (Block 3)
- `api.getLogs(runId)` (Block 3)
- `api.getDataQuality(runId)` (Block 1 + extensão Block 3)

Frontend `TrustCenterPanel` passa a renderizar:
- Overall confidence vem de `summary.confidence_score` + `confidence_label`.
- Calibração vem de comparação `observed_conversion_rate` vs `model_conversion_rate`.
- Qualidade de dados (cobertura, match, etc.) vem de `data_quality_checks` filtrado por `check_name`.
- Alertas críticos: rows com `severity in ("critical", "high")`.
- Checks de qualidade: total / passados.

Aba "Entradas" do `ExecutionDetailsPanel`: tabela de `model_run_inputs` (source, query, row_count, date range, hash).
Aba "Logs" do `ExecutionDetailsPanel`: timeline de `model_run_logs` (step, status, duration, message).

Commit: `feat(executions): consume real /inputs + /logs + /summary; Trust Center live`.

---

## Validation gate

- [ ] `python run.py` → `model_run_inputs` tem rows (1 por query); `model_run_logs` tem rows (1 por step × 2: started + success).
- [ ] Forçar erro num step (mock) deixa um log `failed` na tabela com `message` preenchido.
- [ ] `/inputs` e `/logs` retornam Pydantic tipado.
- [ ] Trust Center mostra valores reais (não mockados) em /execucoes-e-qualidade.
- [ ] Aba "Logs" mostra timeline real.
- [ ] `pytest` + `npm test` verdes.

## Critérios de aceite

- Reproducibilidade: dois `run.py` consecutivos com os mesmos parâmetros geram o **mesmo** `data_hash` por query.
- Forçar exception num step deixa log `failed` antes da exception propagar.
- Logs e inputs deletam em cascade quando `model_runs.id` é deletado.

---

## Out of scope

- Web UI para baixar/exportar logs — toast "exportar" basta por ora.
- Alertas push (Slack/email) em `failed` — fora do escopo do bloco.
- Compactação de logs antigos — Block 6 ops opcional.
