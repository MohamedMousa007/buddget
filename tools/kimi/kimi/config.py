"""Central config: models, paths, push policy.

Env-driven so the latest Moonshot model can be swapped without code edits.
Drop the new value into the project's `.env.kimi` and it picks up.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


def _project_root() -> Path:
    """Walk up from CWD until we find a `.git` dir; that's the project root."""
    cur = Path.cwd().resolve()
    for parent in [cur, *cur.parents]:
        if (parent / ".git").exists() or (parent / "package.json").exists():
            return parent
    return cur


PROJECT_ROOT: Path = _project_root()


def _find_env_kimi() -> Path | None:
    """Walk up from project root looking for `.env.kimi`. Worktrees often live
    under a parent that has the env file; checking only the project root would
    miss it."""
    for p in [PROJECT_ROOT, *PROJECT_ROOT.parents]:
        candidate = p / ".env.kimi"
        if candidate.exists():
            return candidate
    return None


_env_kimi = _find_env_kimi()
if _env_kimi:
    load_dotenv(_env_kimi)


# ─── Models ────────────────────────────────────────────────────────────
# Latest Moonshot text + vision models. Override either via env in .env.kimi
# without touching code.
MODEL: str = os.getenv("KIMI_MODEL", "kimi-k2.6")
VISION_MODEL: str = os.getenv("KIMI_VISION_MODEL", "moonshot-v1-32k-vision-preview")
BASE_URL: str = os.getenv("KIMI_BASE_URL", "https://api.moonshot.ai/v1")

# Default sampling
TEMPERATURE: float = float(os.getenv("KIMI_TEMPERATURE", "1.0"))  # k2.6 only accepts 1
MAX_TOKENS: int = int(os.getenv("KIMI_MAX_TOKENS", "4096"))


# ─── Runtime state ─────────────────────────────────────────────────────
KIMI_DIR: Path = PROJECT_ROOT / ".kimi"
SESSIONS_DIR: Path = KIMI_DIR / "sessions"
USAGE_CSV: Path = KIMI_DIR / "usage.csv"
MEMORY_PATH: Path = KIMI_DIR / "memory.json"

# Pricing (USD per 1M tokens; rough Moonshot k2.6 numbers — update freely).
PRICE_INPUT_PER_M: float = float(os.getenv("KIMI_PRICE_IN", "0.60"))
PRICE_OUTPUT_PER_M: float = float(os.getenv("KIMI_PRICE_OUT", "2.50"))


# ─── Push policy ───────────────────────────────────────────────────────
DEV_BRANCH: str = os.getenv("KIMI_DEV_BRANCH", "dev")
MAIN_BRANCH: str = os.getenv("KIMI_MAIN_BRANCH", "main")
ALLOW_MAIN: bool = os.getenv("KIMI_ALLOW_MAIN", "0") == "1"


def ensure_dirs() -> None:
    KIMI_DIR.mkdir(exist_ok=True)
    SESSIONS_DIR.mkdir(exist_ok=True)
