"""Application code-version metadata."""

from __future__ import annotations

import os
import subprocess
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def get_code_version() -> str:
    """Return the deploy code version, preferring Docker-provided metadata."""

    env_version = os.getenv("CODE_VERSION")
    if env_version:
        return env_version

    try:
        repo_root = Path(__file__).resolve().parents[4]
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=repo_root,
            text=True,
        ).strip()
    except Exception:
        return "unknown"
