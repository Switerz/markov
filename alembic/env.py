from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

config = context.config
_ENV_DATABASE_URL = os.environ.get("DATABASE_URL")

from gograph.backend.app.db.base import Base  # noqa: E402
from gograph.backend.app.db import models  # noqa: E402,F401

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
_DEFAULT_DATABASE_URL = "sqlite:///gograph.db"


def _database_url() -> str:
    x_args = context.get_x_argument(as_dictionary=True)
    configured_url = config.get_main_option("sqlalchemy.url")
    if x_args.get("database_url"):
        return x_args["database_url"]
    if configured_url and configured_url != _DEFAULT_DATABASE_URL:
        return configured_url
    return _ENV_DATABASE_URL or configured_url


config.set_main_option("sqlalchemy.url", _database_url())


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _database_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
