# Block 0 — Dockerize the stack

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Empacotar o stack (FastAPI backend + Vite/React frontend + futuro Postgres) em containers Docker com `docker-compose` que sobem o ambiente completo em um comando, com perfis `dev` (hot reload) e `prod` (build otimizado).

**Architecture:**
- 1 `Dockerfile` por serviço (`backend`, `frontend`) — multi-stage para produção.
- 1 `docker-compose.yml` com `profiles`: `dev` (uvicorn `--reload` + vite dev na porta 5173) e `prod` (uvicorn produção + frontend buildado servido por nginx na porta 80).
- 1 serviço opcional `db` (Postgres 16) — habilitado por profile `pg`, desativado por padrão até Block 5.
- Volumes nomeados para `gograph.db` (SQLite), `node_modules`, `.venv` (eviting host filesystem perf hits no WSL).
- `.dockerignore` em cada raiz para evitar copiar `node_modules`, `.venv`, `results/`, `.git`, etc.
- `.env` na raiz do compose serve as variáveis de ambiente — espelha `.env.example` da raiz Python + adiciona `VITE_API_BASE`.

**Tech Stack:**
- Docker 24+, docker-compose v2 (CLI moderna: `docker compose ...`).
- Backend image: `python:3.12-slim` + pip.
- Frontend image (dev): `node:22-alpine`. Frontend image (prod): multi-stage build → `nginx:1.27-alpine`.
- Postgres image (futuro): `postgres:16-alpine`.

**Premissas:**
- O dev usa WSL2 Ubuntu (gitStatus mostra Linux 6.6 WSL). Volumes Docker funcionam, mas devemos usar volumes nomeados para `node_modules` e `.venv` para evitar I/O cross-filesystem que mata performance.
- Backend depende de `requirements.txt` (já existe). Frontend depende de `package.json` em `gograph/frontend/`.
- O `.env` da raiz do projeto contém `METABASE_URL`/`METABASE_API_KEY` reais — não commitar; volume mount.
- O fluxo `./dev.sh` atual (uvicorn + npm run dev em background) continua funcionando — não removemos.

**Gate de pronto:**
- `docker compose --profile dev up` traz API em http://localhost:8000 e frontend em http://localhost:5173, ambos com hot reload, em <60s a partir de cache quente.
- `docker compose --profile prod up --build` traz frontend em http://localhost (porta 80) servindo o `dist/` + API proxiada.
- `curl http://localhost:8000/health` retorna 200 dentro de 10s após `docker compose up`.
- `pytest` rodando dentro do container backend passa.
- `npm test` rodando dentro do container frontend passa.
- O fluxo legacy `./dev.sh` continua funcionando para devs que preferem rodar nativo.

---

## Phase 0.A — `.dockerignore` e prep

### Task 0.A.1 — Backend `.dockerignore`

**Files:**
- Create: `/.dockerignore` (raiz do repo — controla o que entra na backend image)

**Step 1:** Conteúdo:
```
.git
.gitignore
.github
.venv
__pycache__
*.pyc
*.pyo
*.pyd
.pytest_cache
.mypy_cache
.ruff_cache
node_modules
gograph/frontend/dist
gograph/frontend/node_modules
results/
*.xlsx
gograph.db
.env
.env.local
docs/
.claude
.agents
.skills-lock.json
PRODUCT.md
README.md
*.md
dev.sh
```

**Step 2:** Commit
```bash
git add .dockerignore
git commit -m "chore(docker): add root .dockerignore"
```

### Task 0.A.2 — Frontend `.dockerignore`

**Files:**
- Create: `gograph/frontend/.dockerignore`

**Step 1:** Conteúdo:
```
node_modules
dist
.git
.gitignore
.vscode
*.log
coverage
```

**Step 2:** Commit
```bash
git add gograph/frontend/.dockerignore
git commit -m "chore(docker): add frontend .dockerignore"
```

---

## Phase 0.B — Backend Dockerfile

### Task 0.B.1 — Criar `docker/backend/Dockerfile`

**Files:**
- Create: `docker/backend/Dockerfile`

**Step 1:** Conteúdo (single-stage; backend não precisa de multi-stage):
```dockerfile
# syntax=docker/dockerfile:1.7

FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# OS deps for pandas/numpy/scipy and healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:8000/health || exit 1

# Override em compose: --reload para dev
CMD ["python", "-m", "uvicorn", "gograph.backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 2:** Build local sanity test (não publica):
```bash
docker build -f docker/backend/Dockerfile -t gograph-backend:dev .
```
Esperado: build conclui em <2min frio, <30s com cache.

**Step 3:** Commit
```bash
git add docker/backend/Dockerfile
git commit -m "feat(docker): backend Dockerfile (python 3.12-slim + uvicorn)"
```

### Task 0.B.2 — Run sanity check do backend container

**Step 1:** Rodar container standalone com volume montado para o código (não usar `.env` ainda):
```bash
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=sqlite:///gograph.db \
  gograph-backend:dev
```

**Step 2:** Em outro terminal:
```bash
curl -s http://localhost:8000/health
```
Esperado: `{"status":"ok","censorship_days":0}` (ou similar).

**Step 3:** `Ctrl+C` no container. Sem commit (apenas validação).

---

## Phase 0.C — Frontend Dockerfile

### Task 0.C.1 — Criar `docker/frontend/Dockerfile`

**Files:**
- Create: `docker/frontend/Dockerfile`

**Step 1:** Multi-stage build:
```dockerfile
# syntax=docker/dockerfile:1.7

# --- Stage 1: deps ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY gograph/frontend/package.json gograph/frontend/package-lock.json ./
RUN npm ci

# --- Stage 2: build (used by prod profile) ---
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY gograph/frontend/ ./
RUN npm run build

# --- Stage 3: dev (used by dev profile) ---
FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY gograph/frontend/ ./
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- Stage 4: prod runtime (nginx serving dist) ---
FROM nginx:1.27-alpine AS prod
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
```

**Step 2:** Criar `docker/frontend/nginx.conf`:
```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # SPA: fallback to index.html
  location / {
    try_files $uri $uri/ /index.html;
  }

  # API proxy (prod: backend exposed via compose network)
  location /api/ {
    proxy_pass http://backend:8000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_addr;
    proxy_read_timeout 600s;
  }

  # Gzip for static assets
  gzip on;
  gzip_types text/plain text/css application/json application/javascript application/wasm text/xml;
  gzip_min_length 1024;
}
```

**Step 3:** Ajustar `package.json` — verifique que `"dev": "vite --host 127.0.0.1"` ainda funciona. **Mudança necessária:** o container precisa servir em `0.0.0.0` para o host enxergar. Editar:
```json
"dev": "vite",
```
Removendo o `--host 127.0.0.1`. O CMD do container passa `--host 0.0.0.0`. Para uso local fora do container, `vite` sem flag bind em `127.0.0.1` por padrão — mas o `dev.sh` antigo passa `--host 127.0.0.1` que vamos restaurar via script. Solução mais limpa: deixar `dev` como `vite` e atualizar `dev.sh` para `npm run dev -- --host 127.0.0.1` quando rodar nativo.

**Step 4:** Build sanity:
```bash
docker build -f docker/frontend/Dockerfile --target dev -t gograph-frontend:dev .
docker build -f docker/frontend/Dockerfile --target prod -t gograph-frontend:prod .
```

**Step 5:** Commit
```bash
git add docker/frontend/Dockerfile docker/frontend/nginx.conf gograph/frontend/package.json dev.sh
git commit -m "feat(docker): frontend Dockerfile (multi-stage dev + nginx prod)"
```

---

## Phase 0.D — `docker-compose.yml` com profiles

### Task 0.D.1 — Criar `docker-compose.yml` na raiz

**Files:**
- Create: `docker-compose.yml`

**Step 1:** Conteúdo:
```yaml
name: gograph

services:
  backend:
    build:
      context: .
      dockerfile: docker/backend/Dockerfile
    image: gograph-backend:dev
    container_name: gograph-backend
    env_file: .env
    environment:
      DATABASE_URL: ${DATABASE_URL:-sqlite:////app/gograph.db}
      # CORS for frontend dev (vite at 5173 from host)
      CORS_ORIGINS: "http://localhost:5173,http://localhost,http://127.0.0.1:5173"
    volumes:
      # Mount source for hot reload (dev only — prod profile overrides)
      - ./gograph:/app/gograph
      - ./config.py:/app/config.py
      - ./extract.py:/app/extract.py
      - ./markov.py:/app/markov.py
      - ./roas.py:/app/roas.py
      - ./run.py:/app/run.py
      # SQLite file persistence
      - gograph_db:/app/db
    ports:
      - "8000:8000"
    profiles: ["dev", "prod"]

  backend-dev:
    extends:
      service: backend
    command: ["python", "-m", "uvicorn", "gograph.backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
    profiles: ["dev"]

  frontend-dev:
    build:
      context: .
      dockerfile: docker/frontend/Dockerfile
      target: dev
    image: gograph-frontend:dev
    container_name: gograph-frontend-dev
    environment:
      VITE_API_BASE: "http://localhost:8000"
    volumes:
      - ./gograph/frontend:/app
      - frontend_node_modules:/app/node_modules
    ports:
      - "5173:5173"
    depends_on:
      - backend
    profiles: ["dev"]

  frontend-prod:
    build:
      context: .
      dockerfile: docker/frontend/Dockerfile
      target: prod
    image: gograph-frontend:prod
    container_name: gograph-frontend-prod
    ports:
      - "80:80"
    depends_on:
      - backend
    profiles: ["prod"]

  db:
    image: postgres:16-alpine
    container_name: gograph-db
    environment:
      POSTGRES_DB: gograph
      POSTGRES_USER: gograph
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-gograph}
    volumes:
      - gograph_pg:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    profiles: ["pg"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gograph"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  gograph_db:
  frontend_node_modules:
  gograph_pg:
```

**Notas críticas:**
- `backend` é a base; `backend-dev` herda e sobrescreve `command` para `--reload`. Em prod, o `backend` original (sem `--reload`) é usado.
- SQLite path muda: `sqlite:////app/gograph.db` (4 slashes = absolute path Linux). O frontend não precisa saber — só conversa via HTTP.
- `frontend-dev` monta o código host (`./gograph/frontend`) com `node_modules` em volume nomeado (não bind) para evitar perf hit do WSL.
- `db` só sobe com `--profile pg` — não atrapalha dev SQLite.

**Step 2:** Adicionar `CORS_ORIGINS` env var no backend. Editar `gograph/backend/app/main.py`:
```python
import os
# ...
allow_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Verifique se a lista hardcoded atual no main.py vai pra env var; mantém valores default = comportamento atual.

**Step 3:** Smoke up:
```bash
docker compose --profile dev up -d
sleep 15
curl -s http://localhost:8000/health
curl -sI http://localhost:5173/ | head -1
```
Esperado: backend retorna JSON, frontend retorna `HTTP/1.1 200 OK`.

**Step 4:** Logs sanity:
```bash
docker compose --profile dev logs backend-dev | tail -20
docker compose --profile dev logs frontend-dev | tail -20
```
Sem erros vermelhos.

**Step 5:** Tear down:
```bash
docker compose --profile dev down
```

**Step 6:** Commit
```bash
git add docker-compose.yml gograph/backend/app/main.py
git commit -m "feat(docker): compose with dev/prod/pg profiles + CORS via env"
```

### Task 0.D.2 — `.env.example` atualizado

**Files:**
- Modify: `.env.example` (raiz)

**Step 1:** Adicionar:
```
# Docker
DATABASE_URL=sqlite:////app/gograph.db
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost,http://localhost:5174
POSTGRES_PASSWORD=gograph

# Frontend
VITE_API_BASE=http://localhost:8000
```

**Step 2:** Commit
```bash
git add .env.example
git commit -m "docs(docker): expand .env.example with docker-relevant vars"
```

---

## Phase 0.E — Tests dentro do container

### Task 0.E.1 — Rodar `pytest` dentro do backend container

**Step 1:**
```bash
docker compose --profile dev run --rm backend pytest -q
```
Esperado: testes passam (mesmos que rodariam no `./dev.sh`).

**Step 2:** Documentar no README. Adicionar em `README.md` (ou criar `docker/README.md`) uma seção "Running with Docker":
```markdown
## Running with Docker

Dev mode (hot reload):
\`\`\`
docker compose --profile dev up
# → frontend: http://localhost:5173
# → backend:  http://localhost:8000
\`\`\`

Prod-like build:
\`\`\`
docker compose --profile prod up --build
# → http://localhost (nginx serving dist + proxy to backend)
\`\`\`

With Postgres (Block 5):
\`\`\`
docker compose --profile dev --profile pg up
\`\`\`

Run tests:
\`\`\`
docker compose --profile dev run --rm backend pytest -q
docker compose --profile dev run --rm frontend-dev npm test
\`\`\`
```

**Step 3:** Commit
```bash
git add README.md docker/README.md
git commit -m "docs(docker): document compose dev/prod/pg + test runs"
```

### Task 0.E.2 — Rodar `npm test` dentro do frontend container

**Step 1:**
```bash
docker compose --profile dev run --rm frontend-dev npm test
```
Esperado: 156 testes verdes (ou contagem corrente).

Sem commit — apenas validação.

---

## Phase 0.F — Prod build sanity

### Task 0.F.1 — `--profile prod` smoke

**Step 1:**
```bash
docker compose --profile prod up --build -d
sleep 30
```

**Step 2:**
```bash
curl -sI http://localhost/
curl -s http://localhost/api/health
```
Esperado: ambos `200 OK`. O frontend prod chama `/api/...` (proxy nginx).

**Step 3:** Frontend prod usa `VITE_API_BASE` — confirmar que a aplicação buildada usa esse valor. Pode ser necessário fazer build com `VITE_API_BASE=/api`:
```dockerfile
# em docker/frontend/Dockerfile, stage build, antes do RUN npm run build:
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=${VITE_API_BASE}
```
E no compose:
```yaml
frontend-prod:
  build:
    context: .
    dockerfile: docker/frontend/Dockerfile
    target: prod
    args:
      VITE_API_BASE: "/api"
```

**Step 4:** Re-up e re-curl. Se o frontend prod faz requisições para `/api/...` e o nginx proxia para `backend:8000`, está OK.

**Step 5:** Tear down:
```bash
docker compose --profile prod down
```

**Step 6:** Commit (ajustes no Dockerfile + compose)
```bash
git add docker/frontend/Dockerfile docker-compose.yml
git commit -m "fix(docker): wire VITE_API_BASE arg for prod build (proxy via nginx)"
```

---

## Phase 0.G — Healthcheck e dependências

### Task 0.G.1 — `depends_on` com condition

**Files:**
- Modify: `docker-compose.yml`

**Step 1:** Adicionar healthcheck no `backend`:
```yaml
backend:
  # ...
  healthcheck:
    test: ["CMD", "curl", "-fsS", "http://localhost:8000/health"]
    interval: 5s
    timeout: 3s
    start_period: 15s
    retries: 5
```

E no `frontend-prod`:
```yaml
depends_on:
  backend:
    condition: service_healthy
```

**Step 2:** Verificar com `docker compose --profile prod up`. O frontend só sobe depois do backend healthy.

**Step 3:** Commit
```bash
git add docker-compose.yml
git commit -m "feat(docker): backend healthcheck + frontend waits for healthy"
```

---

## Validation gate — pronto para o Block 1?

Antes de mover para Block 1, confirmar:

- [ ] `docker compose --profile dev up -d` traz tudo online em <60s (cache quente).
- [ ] `curl http://localhost:8000/health` retorna 200.
- [ ] `curl -sI http://localhost:5173/` retorna 200.
- [ ] Editar um `.tsx` em `gograph/frontend/src/` dispara HMR no container `frontend-dev` (visível em `docker compose logs frontend-dev`).
- [ ] Editar um `.py` em `gograph/backend/` dispara reload no `backend-dev` (visível em logs).
- [ ] `docker compose --profile prod up --build` serve frontend buildado em http://localhost (porta 80) e proxia API.
- [ ] `docker compose --profile dev run --rm backend pytest -q` passa.
- [ ] `docker compose --profile dev run --rm frontend-dev npm test` passa.
- [ ] `./dev.sh` ainda funciona para dev nativo (sem container).
- [ ] `gograph.db` persiste entre `docker compose down` e `up` (volume nomeado).

## Critérios de aceite finais

- 0 secrets commitados (verificado com `git diff --stat`).
- `.env` segue como `.gitignore`'d; só `.env.example` versionado.
- Compose v2 sintaxe (não usa `version:` field — depreciado).
- Volumes nomeados para `node_modules` e `gograph.db` (NÃO bind mount cross-FS).
- Profiles `dev`, `prod`, `pg` documentados no README.
- Healthchecks funcionais em backend e frontend-prod.
- WSL-friendly: testar uma vez em WSL2 antes de fechar o bloco.

---

## Out of scope (vai para outro bloco se necessário)

- CI/CD (GitHub Actions): tratar em Block 6 opcional.
- Container registry push: tratar em Block 6.
- Kubernetes manifests: fora do escopo da modernização.
- `docker-bake`: não necessário agora.
- Image security scanning: Block 6.
- Backup automatizado do volume Postgres: tratar quando migrar pra Postgres (Block 5).
