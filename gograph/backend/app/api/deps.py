"""FastAPI dependency helpers."""

from collections.abc import Generator

from fastapi import Request
from sqlalchemy.orm import Session

from gograph.backend.app.db.session import get_session_factory


def get_db_session(request: Request) -> Generator[Session, None, None]:
    database_url = getattr(request.app.state, "database_url", None)
    session_factory = get_session_factory(database_url)
    session = session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
