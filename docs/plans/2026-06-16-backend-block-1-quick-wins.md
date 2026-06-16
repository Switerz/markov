# Block 1 — Quick wins: Pydantic strict + expose PFC/session_quality

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminar `rows: list[dict[str, Any]]` em todos os endpoints atuais, substituindo por Pydantic models tipados; e expor campos que já são calculados internamente (`pfc_weight`, `pfc_delta_pp`, `session_quality`) nos endpoints `/channels` e `/session-quality`. Sem mudança de schema de DB — só na camada de saída.

**Architecture:** O backend hoje tem 22 endpoints retornando `TableResponse { model_run_id, table, rows: list[dict[str, Any]] }`. Vamos:
1. Tornar `TableResponse` genérico: `TableResponse[T]` onde `T` é um Pydantic model específico.
2. Criar um Pydantic model por endpoint de tabela (`ChannelMetricRow`, `DiagnosticRow`, `PathRow`, etc.) — fonte única da verdade.
3. Endpoint passa a declarar `response_model=TableResponse[ChannelMetricRow]` etc.
4. Os campos PFC já são calculados em `services/model_service.py` mas não saem no payload — adicionar.

**Tech Stack:** Pydantic 2.x (já instalado), FastAPI (já configurado para gerar OpenAPI). Sem novas deps.

**Premissas:**
- Frontend já tem tipos em `src/lib/api.ts` que espelham as estruturas — quando o backend passar a retornar `pfc_weight` etc., os tipos já existem ou são triviais de adicionar.
- `pytest` existente cobre alguns services; adicionaremos testes de contrato dos endpoints com `httpx` AsyncClient.

**Gate de pronto:**
- 0 ocorrências de `dict[str, Any]` em retornos de endpoints.
- OpenAPI schema (`/docs`) mostra cada row shape tipado.
- `/channels/{run_id}` retorna `pfc_weight` e `pfc_delta_pp` em cada row (quando o cálculo for aplicável; senão `None`).
- `/session-quality/{run_id}` retorna o shape completo de SessionQuality.
- Frontend `src/lib/api.ts` tem campos atualizados; nenhum tipo perdido.

---

## Phase 1.A — Pydantic models para cada row shape

### Task 1.A.1 — Criar `gograph/backend/app/api/row_schemas.py`

**Files:**
- Create: `gograph/backend/app/api/row_schemas.py`

**Step 1:** Auditar os endpoints atuais. Para cada, identificar o shape da row hoje retornada (ler `services/*.py` que produzem o DataFrame e os modelos em `db/models.py`).

Lista de rows necessárias (1 Pydantic class por endpoint):
- `ChannelMetricRow` — para `/channels` e `/raw-channels`.
- `DiagnosticRow` — para `/diagnostics`.
- `InsightRow` — para `/insights`.
- `TouchpointRow` — para `/touchpoints`.
- `TransitionRow` — para `/transitions`.
- `PathRow` — para `/paths` e `/loops`.
- `DataQualityRow` — para `/data-quality`.
- `LoopDiagnosticRow` — para `/loop-diagnostics`.
- `FunnelAttributionRow` — para `/funnel-attribution`.
- `FunnelValidationRow` — para `/funnel-validation`.
- `SequentialEffectRow` — para `/sequential-effects`.
- `SessionQualityRow` — para `/session-quality`.

**Step 2:** Cada classe segue o padrão:
```python
from pydantic import BaseModel, ConfigDict
from typing import Optional

class ChannelMetricRow(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    channel: str
    markov_weight: Optional[float] = None
    markov_revenue: Optional[float] = None
    removal_effect: Optional[float] = None
    shapley_weight: Optional[float] = None
    shapley_revenue: Optional[float] = None
    shapley_value: Optional[float] = None
    spend: Optional[float] = None
    roas_markov: Optional[float] = None
    roas_shapley: Optional[float] = None
    first_click_revenue: Optional[float] = None
    first_click_roas: Optional[float] = None
    last_click_revenue: Optional[float] = None
    last_click_roas: Optional[float] = None
    pfc_weight: Optional[float] = None        # NEW — expose existing calc
    pfc_delta_pp: Optional[float] = None       # NEW
    recommendation: Optional[str] = None
```

Documentar cada campo no docstring quando o nome não for óbvio.

**Step 3:** Commit
```bash
git add gograph/backend/app/api/row_schemas.py
git commit -m "feat(api): Pydantic row schemas per endpoint (incl. PFC fields)"
```

### Task 1.A.2 — Tornar `TableResponse` genérico

**Files:**
- Modify: `gograph/backend/app/api/schemas.py`

**Step 1:** Substituir o `TableResponse` atual por:
```python
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

class TableResponse(BaseModel, Generic[T]):
    model_run_id: int
    table: str
    rows: list[T]
```

FastAPI 0.103+ + Pydantic 2 suportam Generic response_model nativamente.

**Step 2:** Smoke check — rodar `python -c "from gograph.backend.app.api.schemas import TableResponse; print(TableResponse)"`. Sem erro.

**Step 3:** Commit
```bash
git add gograph/backend/app/api/schemas.py
git commit -m "feat(api): TableResponse[T] generic over row Pydantic models"
```

---

## Phase 1.B — Migrar endpoints um por um

Padrão para cada endpoint: anotar `response_model=TableResponse[XRow]` e garantir que o service retorna dicts compatíveis (Pydantic faz a coerção automática via `from_attributes=True`).

### Task 1.B.1 — `/channels` + expose PFC

**Files:**
- Modify: `gograph/backend/app/api/model_runs.py` (endpoint `get_channels`)
- Modify: `gograph/backend/app/services/persistence_service.py` (função que monta a tabela de channels)

**Step 1:** Localizar onde os dados de channel são serializados hoje. Buscar:
```bash
grep -n "table.*channels\|attribution_results" gograph/backend/app/services/persistence_service.py
```

**Step 2:** Garantir que a query inclui os campos `pfc_weight` e `pfc_delta_pp`. Hoje o `model_service.py` calcula PFC e armazena em `AttributionResult.pfc_weight` etc. (verificar — pode estar em outra tabela ou só em memória).

Se PFC só está em memória durante a execução, persistir agora em `AttributionResult` (adicionar coluna se faltar; sem Alembic ainda, usar `create_all` no startup que cria coluna nova em SQLite via `ALTER TABLE` fallback OU resetar dev DB).

**Step 3:** Endpoint:
```python
@router.get("/{model_run_id}/channels", response_model=TableResponse[ChannelMetricRow])
def get_channels(...) -> TableResponse[ChannelMetricRow]:
    ...
    return TableResponse[ChannelMetricRow](
        model_run_id=model_run_id,
        table="channels",
        rows=[ChannelMetricRow.model_validate(r) for r in rows],
    )
```

**Step 4:** Test (adicionar `tests/backend/test_channels_endpoint.py`):
```python
def test_channels_endpoint_returns_pfc_fields(client, sample_run_id):
    res = client.get(f"/model-runs/{sample_run_id}/channels")
    assert res.status_code == 200
    body = res.json()
    assert "rows" in body
    if body["rows"]:
        row = body["rows"][0]
        assert "pfc_weight" in row
        assert "pfc_delta_pp" in row
```

**Step 5:** Rodar `pytest tests/backend/test_channels_endpoint.py`.

**Step 6:** Commit
```bash
git add gograph/backend/app/api/model_runs.py gograph/backend/app/api/row_schemas.py tests/backend/test_channels_endpoint.py
git commit -m "feat(channels): typed response + expose PFC fields"
```

### Task 1.B.2 — `/raw-channels`

Mesmo padrão. Pode reusar `ChannelMetricRow` ou criar `RawChannelRow` se shape diferir.

Commit: `feat(raw-channels): typed response`

### Task 1.B.3 — `/diagnostics`

`DiagnosticRow` deve ter os campos de presença, role, posição (first/middle/last touch share), delta Markov vs Shapley.

Commit: `feat(diagnostics): typed response`

### Task 1.B.4 — `/insights`

Insights são strings + canal + tone. `InsightRow { channel, label, message, tone, severity }`.

Commit: `feat(insights): typed response`

### Task 1.B.5 — `/touchpoints`

Métricas de touchpoint (count, conversion_count, etc.).

Commit: `feat(touchpoints): typed response`

### Task 1.B.6 — `/transitions`

`TransitionRow { from_state, to_state, transition_type, count, probability, revenue }`.

Commit: `feat(transitions): typed response`

### Task 1.B.7 — `/paths` e `/loops`

Mesmo `PathRow`.

Commit: `feat(paths,loops): typed response`

### Task 1.B.8 — `/data-quality`

`DataQualityRow { check_name, status, severity, detail }` (matching atual; novos campos `score`/`affected_rows`/`recommendation` chegam em Block 3).

Commit: `feat(data-quality): typed response`

### Task 1.B.9 — `/loop-diagnostics`

Já existe Pydantic-friendly em `db/models.py`. Mapear para `LoopDiagnosticRow`.

Commit: `feat(loop-diagnostics): typed response`

### Task 1.B.10 — `/funnel-attribution` + `/funnel-validation`

`FunnelAttributionRow` e `FunnelValidationRow`.

Commit: `feat(funnel): typed responses (attribution + validation)`

### Task 1.B.11 — `/sequential-effects`

`SequentialEffectRow`.

Commit: `feat(sequential-effects): typed response`

### Task 1.B.12 — `/session-quality`

Hoje pode estar retornando `dict[str, Any]` ou nem retornando (verificar). Criar `SessionQualityRow` com TODOS os campos da tabela `SessionQuality` em `db/models.py`.

Commit: `feat(session-quality): typed response + complete row shape`

---

## Phase 1.C — Atualizar frontend `lib/api.ts`

### Task 1.C.1 — Sincronizar tipos TS com Pydantic

**Files:**
- Modify: `gograph/frontend/src/lib/api.ts`

**Step 1:** Para cada `XRow` em `row_schemas.py`, garantir que existe `XRow` em TS. Adicionar:
```ts
export type ChannelRow = {
  channel: string;
  markov_weight?: number | null;
  // ...
  pfc_weight?: number | null;   // NEW
  pfc_delta_pp?: number | null; // NEW
  // ...
};
```

**Step 2:** Atualizar consumidores no frontend que renderizam PFC (se houver — provavelmente nenhum hoje, mas Channel 360 quer mostrar). Documentar com `TODO(api): use pfc_weight` nos componentes relevantes — não implementar UI agora; Block 2 trata a tela.

**Step 3:** `npm run build` deve continuar verde.

**Step 4:** Commit
```bash
git add gograph/frontend/src/lib/api.ts
git commit -m "feat(api-client): sync types with backend row schemas (incl. PFC)"
```

---

## Phase 1.D — Test sweep

### Task 1.D.1 — Contract tests para todos os endpoints

**Files:**
- Create: `tests/backend/test_endpoints_contract.py`

**Step 1:** Um teste por endpoint que:
1. Cria um model_run de teste via fixture (existe ou criar).
2. Chama o endpoint.
3. Valida que a resposta bate com o Pydantic schema.

```python
import pytest
from fastapi.testclient import TestClient
from gograph.backend.app.main import app
from gograph.backend.app.api.schemas import TableResponse
from gograph.backend.app.api.row_schemas import (
    ChannelMetricRow, DiagnosticRow, PathRow, # ...
)

@pytest.fixture
def client():
    return TestClient(app)

@pytest.mark.parametrize("path,row_model", [
    ("/channels", ChannelMetricRow),
    ("/diagnostics", DiagnosticRow),
    ("/paths", PathRow),
    # ... 12 endpoints
])
def test_endpoint_contract(client, sample_run_id, path, row_model):
    res = client.get(f"/model-runs/{sample_run_id}{path}")
    assert res.status_code == 200
    body = res.json()
    # Validate via Pydantic (raises if shape wrong)
    parsed = TableResponse[row_model].model_validate(body)
    assert parsed.model_run_id == sample_run_id
```

**Step 2:** Rodar `pytest tests/backend/test_endpoints_contract.py -v`. Todos verdes.

**Step 3:** Commit
```bash
git add tests/backend/test_endpoints_contract.py
git commit -m "test(api): contract tests validating row schemas per endpoint"
```

### Task 1.D.2 — OpenAPI schema sanity

**Step 1:**
```bash
docker compose --profile dev up -d backend-dev
curl -s http://localhost:8000/openapi.json > /tmp/openapi.json
python -c "
import json
o = json.load(open('/tmp/openapi.json'))
# Garantir que cada endpoint /model-runs/{model_run_id}/X tem schema definido
for path, methods in o['paths'].items():
    if '/model-runs/' in path:
        for method, spec in methods.items():
            responses = spec.get('responses', {})
            schema = responses.get('200', {}).get('content', {}).get('application/json', {}).get('schema')
            assert schema is not None, f'No schema for {method.upper()} {path}'
print('OK — todos endpoints têm response schema')
"
```

Sem commit — validação.

---

## Validation gate — pronto para o Block 2?

- [ ] Nenhum `dict[str, Any]` em retorno de endpoint (`grep -rn "dict\[str, Any\]" gograph/backend/app/api/ | grep -v -e test -e _schemas` retorna vazio).
- [ ] `/docs` (Swagger) mostra schema tipado em cada endpoint.
- [ ] `/channels/{id}` resposta inclui `pfc_weight` e `pfc_delta_pp` (mesmo que `None` quando não calculado).
- [ ] `/session-quality/{id}` resposta tem todos os campos de `SessionQualityRow`.
- [ ] `pytest tests/backend/` 100% verde.
- [ ] `npm test` no frontend 100% verde.
- [ ] Frontend ainda funciona em http://localhost:5173 (smoke manual em 3 rotas).

## Critérios de aceite

- 12 endpoints migrados.
- 12 row schemas Pydantic.
- 1 contract test parametrizado cobrindo os 12.
- Frontend `lib/api.ts` sincronizado.
- Sem regressão visual no frontend.

---

## Out of scope (vai para outros blocks)

- Novos endpoints agregados (`/dashboard/overview`, `/dashboard/budget`) — Block 2.
- Persistir `pfc_weight` no schema do DB se ainda for in-memory — Block 2 ou 5 dependendo do urgência.
- Paginação SQL — Block 5.
- `model_run_summary` / `channel_recommendations` — Block 2.
