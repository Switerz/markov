#!/usr/bin/env bash
# Start API (uvicorn) + frontend (vite) together. Ctrl+C stops both.
set -e

cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "[dev] .venv not found — run: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

if [ ! -d gograph/frontend/node_modules ]; then
  echo "[dev] installing frontend deps..."
  (cd gograph/frontend && npm install)
fi

# shellcheck disable=SC1091
source .venv/bin/activate

cleanup() {
  echo
  echo "[dev] stopping..."
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[dev] API   → http://127.0.0.1:8000"
echo "[dev] Front → http://127.0.0.1:5173"

python -m uvicorn gograph.backend.app.main:app --reload --port 8000 &
(cd gograph/frontend && npm run dev -- --host 127.0.0.1) &

wait
