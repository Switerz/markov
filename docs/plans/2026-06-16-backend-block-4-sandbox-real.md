# Block 4 — Sandbox real (`scenarios` tipado + `scenario_graph` + `scenario_analysis` persistido)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refatorar a tabela `scenarios` para refletir os tipos de ação reais (`removeChannel`, `reducePresence`, `redistributeBudget`, `compareModels`), separar o grafo em `scenario_graph`, e persistir cada análise de cenário em `scenario_analysis` com `model_run_id` + `code_version` para histórico auditável. `/experimentos` e o "Simular caminho" do `/jornadas` deixam de ser locais.

**Architecture:**
- `scenarios` ganha colunas tipadas: `action_type`, `channel`, `intensity_pct`, `period_start`, `period_end`. O `name`/`description` continuam livres.
- Os campos `nodes` e `edges` saem de `scenarios` e vão para `scenario_graph (scenario_id PK)`.
- Nova tabela `scenario_analysis` armazena o último resultado da análise por scenario. Inclui `code_version` (capturado de `git rev-parse HEAD` em `code_version_service`). Quando o cenário é re-analisado, a row é atualizada; a UI exibe "Analisado em X com versão Y; rerun atualiza".
- Endpoints novos seguem o padrão do doc:
  - `GET /model-runs/{id}/scenarios`
  - `POST /model-runs/{id}/scenarios`
  - `GET /scenarios/{id}` (já existe sob outro path — consolidar)
  - `PUT /scenarios/{id}`
  - `DELETE /scenarios/{id}`
  - `POST /scenarios/{id}/analyze` (já existe — agora persiste em `scenario_analysis`)
  - `POST /model-runs/{id}/scenarios/compare` (suporta `baseline_run_id` + lista de `scenario_ids` + `compare_run_id`)
- Frontend: `ScenarioBuilderForm` (Experimentos) e `JourneyPathBuilder` (Jornadas) gravam de verdade via API.

**Tech Stack:** sem deps novas. Usar `subprocess` para `git rev-parse HEAD` ao iniciar o app (cache em memória) ou ler de env var `CODE_VERSION` setada no Docker build.

**Premissas:**
- Blocks 0–3 entregues.
- Migration de dados em `scenarios` existentes: para dev local podemos resetar; documentar no `Block 5 + Alembic` como migration formal.
- `analyze` continua síncrono no MVP. Async/queue fica para Block 6 opcional.

**Gate de pronto:**
- Tabelas `scenarios`/`scenario_graph`/`scenario_analysis` no schema.
- Endpoints CRUD + analyze + compare funcionais e tipados.
- Frontend Experiments grava + analisa + lista cenários reais.
- Frontend Journeys "Simular caminho" grava cenário do tipo `path` + dispara analyze.
- Histórico de análise por cenário visível na UI (timestamp + version).

---

## Phase 4.A — Schema

### Task 4.A.1 — Refactor `scenarios` + `scenario_graph` + `scenario_analysis`

**Files:** modify `gograph/backend/app/db/models.py`

```python
class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id", ondelete="CASCADE"))
    name: Mapped[str]
    description: Mapped[Optional[str]]
    action_type: Mapped[str]                     # removeChannel|reducePresence|redistributeBudget|compareModels|path
    channel: Mapped[Optional[str]]
    intensity_pct: Mapped[Optional[float]]
    period_start: Mapped[Optional[date]]
    period_end: Mapped[Optional[date]]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]


class ScenarioGraph(Base):
    __tablename__ = "scenario_graph"

    scenario_id: Mapped[int] = mapped_column(ForeignKey("scenarios.id", ondelete="CASCADE"), primary_key=True)
    nodes_json: Mapped[str]
    edges_json: Mapped[str]
    path_channels_json: Mapped[str]


class ScenarioAnalysis(Base):
    __tablename__ = "scenario_analysis"

    scenario_id: Mapped[int] = mapped_column(ForeignKey("scenarios.id", ondelete="CASCADE"), primary_key=True)
    model_run_id: Mapped[int]                    # snapshot of which run produced this analysis
    code_version: Mapped[str]                    # git sha at time of analysis
    analyzed_at: Mapped[datetime]
    path_probability: Mapped[Optional[float]]
    conversion_probability_given_last_node: Mapped[Optional[float]]
    composite_conversion_probability: Mapped[Optional[float]]
    historical_conversion_rate: Mapped[Optional[float]]
    lift: Mapped[Optional[float]]
    expected_revenue: Mapped[Optional[float]]
    expected_ticket: Mapped[Optional[float]]
    historical_support: Mapped[int]
    confidence_score: Mapped[Optional[float]]
    warnings_json: Mapped[str]                   # JSON list
    similar_paths_json: Mapped[str]              # JSON list
```

Commit: `feat(db): scenarios refactor (typed) + scenario_graph + scenario_analysis`

### Task 4.A.2 — Pydantic schemas

`ScenarioRow`, `ScenarioGraphData`, `ScenarioAnalysisRow` em `row_schemas.py`. Note que `*_json` strings viram listas no Pydantic via validator.

Commit: `feat(api): scenarios row schemas`

---

## Phase 4.B — `code_version_service`

```python
# services/code_version_service.py
import os
import subprocess
from functools import lru_cache

@lru_cache(maxsize=1)
def get_code_version() -> str:
    if os.getenv("CODE_VERSION"):
        return os.environ["CODE_VERSION"]
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=os.path.dirname(__file__),
            text=True,
        ).strip()
    except Exception:
        return "unknown"
```

No Docker build, passar `CODE_VERSION` como ARG/ENV:
```dockerfile
ARG CODE_VERSION=unknown
ENV CODE_VERSION=${CODE_VERSION}
```

Commit: `feat(meta): code_version_service`

---

## Phase 4.C — Refactor endpoints `/sandbox/*` → `/model-runs/{id}/scenarios/*`

### Task 4.C.1 — Mover routes

Hoje endpoints estão em `/sandbox/*`. Mudar para `/model-runs/{id}/scenarios/*`. Manter o prefixo antigo como alias (return 308 redirect) por 1 release. Documentar deprecação.

### Task 4.C.2 — `POST /model-runs/{id}/scenarios`

Cria scenario + scenario_graph atomicamente:
```python
@router.post("/{model_run_id}/scenarios", response_model=ScenarioRow)
def create_scenario(model_run_id: int, payload: ScenarioCreatePayload, ...):
    scenario = Scenario(model_run_id=model_run_id, **payload.scalar_fields)
    session.add(scenario); session.flush()
    graph = ScenarioGraph(scenario_id=scenario.id, **payload.graph_fields)
    session.add(graph)
    session.commit()
    return ScenarioRow.from_db(scenario, graph)
```

Validação: `action_type` em set permitido; quando `action_type == "removeChannel"` o campo `channel` é obrigatório; quando `action_type == "reducePresence"`, ambos `channel` e `intensity_pct` obrigatórios; quando `action_type == "path"`, `nodes` e `edges` obrigatórios.

Commit: `feat(scenarios): typed POST create`

### Task 4.C.3 — `POST /scenarios/{id}/analyze` persiste

Hoje retorna a análise. Agora também faz `upsert` em `scenario_analysis` com `model_run_id` + `code_version` + `analyzed_at = now`.

Commit: `feat(scenarios): analyze persists result with code_version`

### Task 4.C.4 — `POST /model-runs/{id}/scenarios/compare`

Aceita `scenario_ids: list[int]`, `include_baseline: bool`, `include_top_path: bool`, `compare_run_id: int | None`. Para cada scenario, retorna o último `scenario_analysis` (não recalcula). Se algum não tem analysis ainda, retorna `null` + warning.

Commit: `feat(scenarios): compare endpoint uses persisted analyses`

---

## Phase 4.D — Frontend

### Task 4.D.1 — Hook `useScenarios(runId)` + mutações

Substituir o `useScenarioSimulation` local por:
- `useScenarios(runId)` → list
- `useCreateScenario(runId)` → mutate
- `useAnalyzeScenario(scenarioId)` → mutate

Commit: `feat(experiments): real scenario CRUD + analyze via API`

### Task 4.D.2 — `ScenarioBuilderForm` grava de verdade

Submit chama `createScenario` então `analyzeScenario`. Resultado aparece na comparison panel + persiste no histórico. Toast de confirmação.

Commit: `feat(experiments): builder persists scenarios + triggers analyze`

### Task 4.D.3 — `JourneyPathBuilder` integra com sandbox

"Simular caminho" no /jornadas: quando há `runId`, cria scenario do tipo `path` com `nodes/edges` do xyflow + analyze. Resultado aparece nos 4 tiles + toast.

Commit: `feat(journeys): path builder persists path-scenario + analyzes`

### Task 4.D.4 — UI de histórico

Em `/experimentos`, mostrar lista de cenários salvos (vem de `useScenarios`). Cada item mostra `analyzed_at` + `code_version` em badge pequeno (tooltip). Permitir deletar (DELETE).

Commit: `feat(experiments): saved scenarios list with version badges`

---

## Validation gate

- [ ] Criar cenário via UI persiste em `scenarios` + `scenario_graph`.
- [ ] Analisar cenário persiste/atualiza row em `scenario_analysis` com `code_version` correto.
- [ ] Reanalisar após edit do cenário sobrescreve row.
- [ ] Listar cenários no /experimentos retorna do DB (não mock).
- [ ] `compare` retorna resultados consistentes para múltiplos scenarios.
- [ ] `pytest` + `npm test` verdes.

## Critérios de aceite

- 0 mocks ativos em `/experimentos` (lista de cenários e comparação).
- Cada cenário mostra "analisado em DD/MM HH:MM com versão XX".
- Validação por `action_type` no POST funciona (422 quando campos faltam).
- "Simular caminho" no /jornadas escreve scenario + analysis quando runId presente.

---

## Out of scope

- Cenários compostos (vários action_types num só) — futuro.
- Versionamento histórico de scenario_analysis (mais de 1 row por scenario) — manter apenas última.
- Análise async/queue — Block 6.
