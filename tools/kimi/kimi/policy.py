"""Push policy + secret scanning + write-path guards."""

from __future__ import annotations

import re
from pathlib import Path

from kimi import config

# Patterns that should never be committed.
SECRET_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"sk-[A-Za-z0-9_-]{20,}"),
    re.compile(r"KIMI_API_KEY\s*=\s*[A-Za-z0-9_-]{20,}"),
    re.compile(r"GEMINI_API_KEY\s*=\s*[A-Za-z0-9_-]{20,}"),
    re.compile(r"OPENAI_API_KEY\s*=\s*[A-Za-z0-9_-]{20,}"),
    re.compile(r"SUPABASE_SERVICE_ROLE_KEY\s*=\s*[A-Za-z0-9_.-]{20,}"),
    re.compile(r"-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}"),  # JWT
]

# Paths the agent must never touch without explicit override.
WRITE_BLOCKLIST: list[str] = [
    "node_modules/",
    ".next/",
    ".git/",
    "tools/kimi/.venv/",
    ".kimi/",
    "supabase/migrations/",  # require --allow-migration to write here
]


def scan_for_secrets(text: str) -> list[str]:
    hits: list[str] = []
    for pat in SECRET_PATTERNS:
        for m in pat.finditer(text):
            hits.append(m.group(0)[:32] + "…")
    return hits


def can_write(path: str | Path, *, allow_migration: bool = False) -> tuple[bool, str]:
    p = str(path).replace("\\", "/")
    for blocked in WRITE_BLOCKLIST:
        if blocked == "supabase/migrations/" and allow_migration:
            continue
        if blocked in p:
            return False, f"refused: write inside `{blocked}` is blocked (override with --allow-migration if appropriate)"
    return True, ""


def can_push(target_branch: str, allow_main: bool) -> tuple[bool, str]:
    if target_branch == config.MAIN_BRANCH and not allow_main:
        return (
            False,
            f"refused: pushing to `{config.MAIN_BRANCH}` requires KIMI_ALLOW_MAIN=1 + interactive confirm. "
            f"Push to `{config.DEV_BRANCH}` instead.",
        )
    if target_branch not in (config.DEV_BRANCH, config.MAIN_BRANCH):
        return False, f"refused: only `{config.DEV_BRANCH}` (or `{config.MAIN_BRANCH}` with override) is allowed."
    return True, ""
