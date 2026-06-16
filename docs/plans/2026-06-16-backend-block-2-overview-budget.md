# Block 2 — Overview & Budget aggregate endpoints

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduzir `model_run_summary` e `channel_recommendations` como tabelas persistidas; expor endpoints agregados `/dashboard/overview` e `/dashboard/budget` que entregam tudo que cada tela precisa em um único round-trip; e remover os mocks correspondentes do frontend (`Overview` e `Decisões de Budget` passam a consumir dados reais).

**Architecture:**
- Em `model_service.run_model`, após calcular Markov + Shapley + ROAS + PFC, gravar:
  - 1 linha em `model_run_summary` com KPIs agregados (revenue, spend, conv_rates, confidence).
  - N linhas em `channel_recommendations` (uma por canal) com decisão, rationale, riscos, best practices, suggested budget delta.
- A lógica de "como derivar a recomendação" sai de hard-coded em `roas.py` para um service dedicado (`recommendation_service`) que toma `channel_metrics` + `session_quality` + PFC e produz a row de `channel_recommendations`. Testável isoladamente.
- Endpoint `/dashboard/overview?compare_run_id=...` retorna um payload composto: metric strip + priority decisions + model consensus matrix + journey summary + confidence — todos calculados a partir de `model_run_summary` + `channel_metrics` (Block 1) + `channel_recommendations` + `top_paths`.
- Endpoint `/dashboard/budget` retorna o equivalente para a tela `Decisões de Budget`.
- Frontend: `useOverviewData()` e `useBudgetDecisionsData()` passam de mock para `useQuery(['dashboard', 'overview', runId, compareRunId])`. Quando o endpoint faltar campos, mantém mock como fallback (com toggle).

**Tech Stack:** SQLAlchemy 2.x, Pydantic 2.x. Sem novas deps.

**Premissas:**
- Block 0 (Docker) e Block 1 (Pydantic typing) concluídos. PFC já está visível nos endpoints.
- O cálculo de "confidence_score" pode ser uma heurística simples (Block 2) e refinado depois.
- `compare_run_id` será sempre opcional; ausência → não calcula deltas, retorna `null` nos campos delta.
- "Priority decisions" hoje no mock são 5 canais com tone/recommendation/share/roas/description. Vai virar derivação real a partir de `channel_recommendations` ordenado por `priority_rank`.

**Gate de pronto:**
- 2 novas tabelas (`model_run_summary`, `channel_recommendations`) persistidas em cada `run_model`.
- 2 novos endpoints (`/dashboard/overview`, `/dashboard/budget`) retornando schema Pydantic completo.
- Frontend Overview e Budget Decisions consumindo API real (sem mocks ativos nos hooks principais; mocks viram fallback documentado).
- `compare_run_id` funcional: passar run anterior calcula deltas em todas as KPIs.
- `pytest` + `npm test` verdes.

---

## Phase 2.A — Schema das tabelas novas

### Task 2.A.1 — Modelos SQLAlchemy

**Files:**
- Modify: `gograph/backend/app/db/models.py`

**Step 1:** Adicionar:

```python
class ModelRunSummary(Base):
    __tablename__ = "model_run_summary"

    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id", ondelete="CASCADE"), primary_key=True)
    observed_conversion_rate: Mapped[Optional[float]]
    model_conversion_rate: Mapped[float]
    total_revenue: Mapped[float]
    total_spend: Mapped[float]
    total_conversions: Mapped[int]
    total_nonconversions_sampled: Mapped[int]
    non_conv_scale: Mapped[Optional[float]]
    state_count: Mapped[int]
    channel_count: Mapped[int]
    path_count: Mapped[int]
    transition_count: Mapped[int]
    confidence_score: Mapped[float]    # 0..1
    confidence_label: Mapped[str]      # "Alta"|"Média"|"Baixa"


class ChannelRecommendation(Base):
    __tablename__ = "channel_recommendations"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id", ondelete="CASCADE"))
    channel: Mapped[str]
    recommendation: Mapped[str]                # Escalar|Defender|Investigar|Reduzir
    recommendation_tone: Mapped[str]           # green|orange|blue|red
    priority_rank: Mapped[int]
    rationale_json: Mapped[str]                # JSON list of strings
    risks_json: Mapped[str]
    best_practices_json: Mapped[str]
    suggested_budget_delta_pct: Mapped[Optional[float]]
    suggested_budget_delta_value: Mapped[Optional[float]]
    estimated_revenue_delta: Mapped[Optional[float]]
    estimated_roas_min: Mapped[Optional[float]]
    estimated_roas_max: Mapped[Optional[float]]
    saturation_score: Mapped[Optional[float]]
    confidence_score: Mapped[float]

    __table_args__ = (UniqueConstraint("model_run_id", "channel"),)
```

`mapped_column`/`Mapped` exigem SQLAlchemy 2.x — confirmar versão.

**Step 2:** `create_db_and_tables` no startup já chama `Base.metadata.create_all(engine)` — em SQLite isso cria tabelas faltando. Para DBs com dados existentes em dev local: ou apagar `gograph.db` e re-rodar `python run.py`, ou anotar TODO para migrar via Alembic em Block 5.

**Step 3:** Commit
```bash
git add gograph/backend/app/db/models.py
git commit -m "feat(db): model_run_summary + channel_recommendations tables"
```

### Task 2.A.2 — Pydantic row schemas

**Files:**
- Modify: `gograph/backend/app/api/row_schemas.py`

**Step 1:** Adicionar:
```python
class ModelRunSummaryRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    observed_conversion_rate: Optional[float] = None
    model_conversion_rate: float
    total_revenue: float
    total_spend: float
    total_conversions: int
    total_nonconversions_sampled: int
    non_conv_scale: Optional[float] = None
    state_count: int
    channel_count: int
    path_count: int
    transition_count: int
    confidence_score: float
    confidence_label: str


class ChannelRecommendationRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    channel: str
    recommendation: str
    recommendation_tone: str
    priority_rank: int
    rationale: list[str]                     # parsed from rationale_json
    risks: list[str]
    best_practices: list[str]
    suggested_budget_delta_pct: Optional[float] = None
    suggested_budget_delta_value: Optional[float] = None
    estimated_revenue_delta: Optional[float] = None
    estimated_roas_min: Optional[float] = None
    estimated_roas_max: Optional[float] = None
    saturation_score: Optional[float] = None
    confidence_score: float
```

JSON fields são `str` no DB e `list[str]` no Pydantic — fazer parse no service que monta a row.

**Step 2:** Commit
```bash
git add gograph/backend/app/api/row_schemas.py
git commit -m "feat(api): row schemas for summary + recommendations"
```

---

## Phase 2.B — Recommendation service

### Task 2.B.1 — `recommendation_service.py`

**Files:**
- Create: `gograph/backend/app/services/recommendation_service.py`

**Step 1:** A função `derive_recommendations(channel_metrics, session_quality, ...) -> list[ChannelRecommendationDict]` aplica as regras hoje espalhadas em `roas.py` (`generate_recommendations`):

```python
def derive_recommendations(
    channel_rows: list[dict],
    session_quality_rows: list[dict] | None = None,
    pfc_threshold: float = 0.05,
) -> list[dict]:
    """
    Input: a row per channel with channel_metrics fields (markov_weight, shapley_weight, roas_markov, etc.).
    Output: a row per channel with recommendation + rationale + budget delta etc.
    
    Rules (synthesized from roas.py):
    - Escalar: high consensus + high ROAS + role≠"context".
    - Defender: high presence + moderate ROAS + Shapley confirms.
    - Investigar: high Markov, low Shapley (or vice-versa).
    - Reduzir: low ROAS + low presence + low PFC.
    
    Priority rank: by estimated_revenue_delta desc.
    """
    ...
```

Implementar com regras claras + comentários do "porquê". Cada recomendação inclui rationale como lista de strings (3–5 bullets), risks (3–5), best_practices (3–5).

`suggested_budget_delta_pct`: para `Escalar`, +15..30% baseado em saturation_score; para `Reduzir`, -20..50%; outros, 0.

**Step 2:** Test unitário:
```python
# tests/backend/services/test_recommendation_service.py
def test_escalar_when_high_consensus_high_roas():
    rows = [{
        "channel": "Google Ads",
        "markov_weight": 0.40, "shapley_weight": 0.38,
        "roas_markov": 7.5, "roas_shapley": 7.1,
        "spend": 1_000_000,
    }]
    result = derive_recommendations(rows)
    assert result[0]["recommendation"] == "Escalar"
    assert result[0]["recommendation_tone"] == "green"
    assert len(result[0]["rationale"]) >= 3

def test_reduzir_when_low_roas_low_presence():
    ...

def test_priority_rank_by_revenue_delta():
    ...
```

**Step 3:** Rodar `pytest tests/backend/services/test_recommendation_service.py -v`. Verde.

**Step 4:** Commit
```bash
git add gograph/backend/app/services/recommendation_service.py tests/backend/services/test_recommendation_service.py
git commit -m "feat(services): recommendation_service (derives Escalar/Defender/Investigar/Reduzir + rationale)"
```

---

## Phase 2.C — Persistence durante `run_model`

### Task 2.C.1 — Gravar `ModelRunSummary` e `ChannelRecommendation`

**Files:**
- Modify: `gograph/backend/app/services/persistence_service.py`
- Modify: `gograph/backend/app/services/model_service.py`

**Step 1:** Em `persistence_service.py`, adicionar:
```python
def save_model_run_summary(session, model_run_id: int, summary: dict) -> None:
    ...

def save_channel_recommendations(session, model_run_id: int, recs: list[dict]) -> None:
    # delete existing for idempotency, then insert
    ...
```

**Step 2:** Em `model_service.run_model`, após o cálculo das atribuições e antes do commit, chamar:
```python
summary = compute_summary(
    channels=channel_rows,
    paths=path_rows,
    transitions=transition_rows,
    observed_rate=observed_cr,
    model_rate=model_cr,
    ...
)
recs = derive_recommendations(channel_rows, session_quality_rows)

save_model_run_summary(session, run.id, summary)
save_channel_recommendations(session, run.id, recs)
```

`compute_summary` é uma função pura em `services/summary_service.py` (criar). `confidence_score` heurístico:
```python
confidence = min(1.0, (
    0.30 * data_quality_score +
    0.25 * (1 - abs(observed_rate - model_rate) / max(observed_rate, 1e-6)) +
    0.25 * coverage_score +
    0.20 * markov_shapley_agreement
))
```
Documentar fórmula inline.

**Step 3:** Test de integração:
```python
def test_run_model_persists_summary_and_recommendations(...):
    # roda o pipeline em mock, valida que rows existem nas tabelas
    ...
```

**Step 4:** Commit
```bash
git add gograph/backend/app/services/persistence_service.py gograph/backend/app/services/model_service.py gograph/backend/app/services/summary_service.py tests/backend/test_run_model_persistence.py
git commit -m "feat(model): persist summary + recommendations on each run"
```

---

## Phase 2.D — Endpoints

### Task 2.D.1 — `GET /model-runs/{id}/summary`

**Files:**
- Modify: `gograph/backend/app/api/model_runs.py`

**Step 1:** Endpoint simples:
```python
@router.get("/{model_run_id}/summary", response_model=ModelRunSummaryRow)
def get_summary(model_run_id: int, session: Session = Depends(get_db_session)):
    row = session.get(ModelRunSummary, model_run_id)
    if not row:
        raise HTTPException(404)
    return ModelRunSummaryRow.model_validate(row)
```

**Step 2:** Test smoke.

**Step 3:** Commit
```bash
git add gograph/backend/app/api/model_runs.py tests/backend/test_summary_endpoint.py
git commit -m "feat(api): GET /model-runs/{id}/summary"
```

### Task 2.D.2 — `GET /model-runs/{id}/recommendations`

Mesmo padrão. Endpoint retorna `list[ChannelRecommendationRow]` ordenado por `priority_rank`.

Commit: `feat(api): GET /model-runs/{id}/recommendations`

### Task 2.D.3 — `GET /model-runs/{id}/dashboard/overview`

**Files:**
- Modify: `gograph/backend/app/api/model_runs.py`
- Create: `gograph/backend/app/api/dashboard_schemas.py` (ou estender row_schemas)

**Step 1:** Definir `OverviewDashboardResponse`:
```python
class OverviewDashboardResponse(BaseModel):
    meta: ResponseMeta  # { model_version, code_version, generated_at, run_id, compare_run_id }
    summary: ModelRunSummaryRow
    metric_strip: list[MetricCardData]    # 6 cards (revenue, spend, ROAS, conv_rate, opportunities, misallocated)
    priority_decisions: list[ChannelRecommendationRow]  # top 5 by priority_rank
    model_consensus: ConsensusMatrixData
    journey_summary: JourneySummaryData
    analysis_confidence: ConfidencePanelData
    footer_note: str
```

Cada sub-shape (`MetricCardData`, `ConsensusMatrixData`, etc.) é um Pydantic model — espelha o JSON do contrato `docs/gograph-refactor-instrucoes/01-visao-geral.md`.

**Step 2:** Endpoint compõe a resposta a partir de:
- `ModelRunSummary` → KPIs + confidence panel.
- `ChannelRecommendation` (top 5) → priority decisions.
- `ChannelMetric` + `attribution_results` → model consensus matrix (x=markov_weight*100, y=shapley_weight*100, size=spend).
- `PathSummary` → journey summary (top entradas, top assistentes, top fechamentos, flow stages).
- Se `compare_run_id` passado, calcula deltas vs aquele run.

**Step 3:** Validação `compare_run_id`:
```python
if compare_run_id:
    compare = session.get(ModelRun, compare_run_id)
    if not compare:
        raise HTTPException(422, "compare_run_id not found")
    if compare.status != "completed":
        raise HTTPException(422, "compare_run_id is not a completed run")
```

**Step 4:** Test:
```python
def test_overview_dashboard_returns_full_payload(client, sample_run_id):
    res = client.get(f"/model-runs/{sample_run_id}/dashboard/overview")
    assert res.status_code == 200
    body = res.json()
    assert "meta" in body
    assert body["meta"]["run_id"] == sample_run_id
    assert len(body["metric_strip"]) == 6
    assert len(body["priority_decisions"]) <= 5
    OverviewDashboardResponse.model_validate(body)  # raises if shape wrong


def test_overview_dashboard_with_compare_returns_deltas(client, run_a, run_b):
    res = client.get(f"/model-runs/{run_a}/dashboard/overview?compare_run_id={run_b}")
    body = res.json()
    assert body["metric_strip"][0]["delta"] is not None


def test_overview_dashboard_invalid_compare_422(client, run_a):
    res = client.get(f"/model-runs/{run_a}/dashboard/overview?compare_run_id=999999")
    assert res.status_code == 422
```

**Step 5:** Commit
```bash
git add gograph/backend/app/api/model_runs.py gograph/backend/app/api/dashboard_schemas.py tests/backend/test_overview_dashboard.py
git commit -m "feat(api): GET /dashboard/overview (aggregated, supports compare_run_id)"
```

### Task 2.D.4 — `GET /model-runs/{id}/dashboard/budget`

Mesmo padrão; payload alinhado com `docs/gograph-refactor-instrucoes/02-decisoes-de-budget.md`:
- `summary_cards`: 4 cards (Escalar/Defender/Investigar/Reduzir contagem).
- `allocation_matrix`: pontos (x=spend_share, y=revenue_share, size=revenue, tone=recommendation_tone).
- `opportunities_and_risks`: derivado de `channel_recommendations` (top 3 oportunidades por suggested_budget_delta_value positivo; top 2 riscos por suggested negativo).
- `channels_table`: todos os channel_metrics + recommendations.
- `selected_channel_drawer`: opcional (`?channel=Google Ads`) — retorna o detalhe expandido para o canal.

Commit: `feat(api): GET /dashboard/budget`

---

## Phase 2.E — Frontend: consumir endpoints reais

### Task 2.E.1 — Hook `useOverviewData` real

**Files:**
- Modify: `gograph/frontend/src/features/overview/hooks/useOverviewData.ts`

**Step 1:**
```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { OverviewData } from "../types";
import { overviewMock } from "../overview.mock";

export function useOverviewData(runId?: number, compareRunId?: number): OverviewData {
  const { data } = useQuery({
    queryKey: ["dashboard", "overview", runId, compareRunId],
    enabled: runId != null,
    queryFn: () => api.getOverviewDashboard(runId!, compareRunId),
  });
  // Until backend payload fully matches OverviewData type, merge with mock for missing fields.
  return data ? mergeWithMock(data, overviewMock) : overviewMock;
}
```

**Step 2:** Adicionar `api.getOverviewDashboard(id, compareId?)` em `lib/api.ts`.

**Step 3:** `OverviewPage.tsx` passa `runId` via `useActiveRun()`.

**Step 4:** Smoke test — verificar que a tela carrega com dados do backend quando há run; com mock quando não há.

**Step 5:** Commit
```bash
git add gograph/frontend/src/features/overview/hooks/useOverviewData.ts gograph/frontend/src/features/overview/OverviewPage.tsx gograph/frontend/src/lib/api.ts
git commit -m "feat(overview): consume real /dashboard/overview endpoint (mock fallback)"
```

### Task 2.E.2 — Hook `useBudgetDecisionsData` real

Mesmo padrão para Budget.

Commit: `feat(budget): consume real /dashboard/budget endpoint`

---

## Validation gate — pronto para o Block 3?

- [ ] Rodar `python run.py` (ou via Docker) gera 1 row em `model_run_summary` + N em `channel_recommendations`.
- [ ] `GET /model-runs/{id}/dashboard/overview` retorna payload completo.
- [ ] `GET /model-runs/{id}/dashboard/overview?compare_run_id=Y` retorna deltas calculados.
- [ ] `GET /model-runs/{id}/dashboard/overview?compare_run_id=999999` retorna 422.
- [ ] `OverviewPage` no frontend usa dados reais (cards mostram valores do DB, não do mock).
- [ ] `BudgetDecisionsPage` idem.
- [ ] `pytest` + `npm test` verdes.

## Critérios de aceite

- 2 tabelas novas, 4 endpoints novos.
- 1 service novo (recommendation_service) com testes.
- 2 hooks frontend migrados.
- `compare_run_id` validado e testado.
- `meta: { model_version, code_version, generated_at }` em cada payload agregado.

---

## Out of scope

- `account_id` (multi-tenant) — adicionado nullable mas sem middleware. Block 6 quando virar requisito.
- `model_run_inputs` / `model_run_logs` — Block 3.
- Persistir `scenario_analysis` — Block 4.
- Consolidar `channel_metrics` (mescla AttributionResult + ChannelDiagnostic) — Block 5.
- Postgres + Alembic — Block 5.
