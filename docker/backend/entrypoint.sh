#!/usr/bin/env sh
set -eu

if [ "${RUN_ALEMBIC_MIGRATIONS:-1}" = "1" ]; then
  tries="${ALEMBIC_MIGRATION_RETRIES:-30}"
  while ! alembic upgrade head; do
    tries=$((tries - 1))
    if [ "$tries" -le 0 ]; then
      echo "alembic upgrade head failed after retries" >&2
      exit 1
    fi
    sleep 1
  done
fi

exec "$@"
