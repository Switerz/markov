"""FastAPI application factory for GoGraph."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
from gograph.backend.app.api.model_runs import router as model_runs_router
from gograph.backend.app.api.sandbox import router as sandbox_router
from gograph.backend.app.db import create_db_and_tables


def create_app(database_url: str | None = None) -> FastAPI:
    app = FastAPI(
        title="GoGraph API",
        version="0.1.0",
        description="Analytical API for Markov/Shapley journey attribution.",
    )
    app.state.database_url = database_url or config.DATABASE_URL
    create_db_and_tables(app.state.database_url)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(model_runs_router)
    app.include_router(sandbox_router)

    @app.get("/")
    def root():
        return {
            "name": "GoGraph API",
            "status": "ok",
            "health": "/health",
            "model_runs": "/model-runs",
            "docs": "/docs",
        }

    @app.get("/health")
    def health():
        return {"status": "ok", "censorship_days": config.CENSORSHIP_DAYS}

    return app


app = create_app()
