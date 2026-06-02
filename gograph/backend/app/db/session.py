"""Database engine/session helpers for GoGraph."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

import config
from gograph.backend.app.db.base import Base


def get_engine(database_url: str | None = None):
    url = database_url or config.DATABASE_URL
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    poolclass = NullPool if url.startswith("sqlite") else None
    return create_engine(
        url,
        connect_args=connect_args,
        future=True,
        poolclass=poolclass,
    )


def get_session_factory(database_url: str | None = None):
    engine = get_engine(database_url)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def create_db_and_tables(database_url: str | None = None) -> None:
    from gograph.backend.app.db import models  # noqa: F401

    engine = get_engine(database_url)
    Base.metadata.create_all(engine)
