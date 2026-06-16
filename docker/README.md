# Docker setup

Block 0 of the backend modernization plan. The stack runs end-to-end inside
containers with `docker compose`, with profiles for `dev` (hot reload),
`prod` (nginx serving the built frontend + API proxy), and `pg` (optional
Postgres for Block 5).

## Profiles

| Profile | Services                              | Ports        |
|---------|---------------------------------------|--------------|
| `dev`   | `backend-dev` (uvicorn `--reload`), `frontend-dev` (Vite) | 8000, 5173 |
| `prod`  | `backend`, `frontend-prod` (nginx)    | 8000, 80     |
| `pg`    | `db` (Postgres 16-alpine)             | 5432         |

## Common commands

```bash
# Dev (hot reload)
docker compose --profile dev up -d

# Prod build
docker compose --profile prod up --build

# Backend tests
docker compose --profile dev run --rm backend-dev pytest -q

# Frontend tests
docker compose --profile dev run --rm frontend-dev npm test

# Tear down
docker compose --profile dev down
```

## Volumes

- `gograph_db` — SQLite database (`/app/db/gograph.db` inside backend
  container). Persists across `down`/`up`.
- `frontend_node_modules` — frontend `node_modules` as a named volume to
  avoid WSL2 cross-filesystem I/O penalty.
- `gograph_pg` — Postgres data (Block 5).

## Environment

The compose file reads `.env` at the repo root via `env_file:`. The
backend defaults `DATABASE_URL` to `sqlite:////app/db/gograph.db` when
running in the container, falling back to `.env` if set.

`CORS_ORIGINS` is passed as an env var to the backend (comma-separated
list of allowed origins). Default mirrors the previous hardcoded list.

## Native dev fallback

`./dev.sh` at the repo root still runs uvicorn + Vite natively without
Docker. Vite binds to `127.0.0.1` via `npm run dev -- --host 127.0.0.1`
in that script; inside the container we bind to `0.0.0.0` so the host
can reach it.
