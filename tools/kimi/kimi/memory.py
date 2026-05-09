"""Project memory — facts the agent should remember across runs.

Bootstrapped from CLAUDE.md / AGENTS.md / MEMORY.md on first run, then
updated by the engineer agent ("learned: …") and `kimi memory edit`.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from kimi import config

_DEFAULT: dict[str, Any] = {
    "project": "Buddget — Next.js + Supabase + Zustand budget tracker",
    "rules": [
        "Auto-merge dev → main is enabled for the Buddget app, but Kimi-authored commits push to dev only and require manual approval before main.",
        "Verify before push: lint + tsc + vitest + next build (with dummy Supabase env).",
        "Token economy: ripgrep before reading; never read whole files when a range will do.",
        "No defensive checks for impossible states. No backwards-compat shims for unreleased code.",
    ],
    "facts": [],
    "last_session": None,
}


def _read() -> dict[str, Any]:
    if not config.MEMORY_PATH.exists():
        return dict(_DEFAULT)
    try:
        return json.loads(config.MEMORY_PATH.read_text())
    except json.JSONDecodeError:
        return dict(_DEFAULT)


def _write(data: dict[str, Any]) -> None:
    config.ensure_dirs()
    config.MEMORY_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def bootstrap() -> dict[str, Any]:
    """Seed memory from CLAUDE.md / AGENTS.md / MEMORY.md if not yet bootstrapped."""
    data = _read()
    if data.get("bootstrapped"):
        return data
    extra_facts: list[str] = []
    for name in ("CLAUDE.md", "AGENTS.md", "MEMORY.md"):
        p = config.PROJECT_ROOT / name
        if p.exists():
            txt = p.read_text(errors="ignore")
            extra_facts.append(f"# from {name}\n{txt[:4000]}")  # cap per file
    if extra_facts:
        data.setdefault("facts", []).extend(extra_facts)
    data["bootstrapped"] = True
    _write(data)
    return data


def load() -> dict[str, Any]:
    return _read()


def save(data: dict[str, Any]) -> None:
    _write(data)


def remember(fact: str) -> None:
    data = _read()
    facts = data.setdefault("facts", [])
    if fact not in facts:
        facts.append(fact)
    _write(data)


def system_prefix() -> str:
    """Stable prefix used in every agent system prompt — fed first so prompt-prefix caching kicks in."""
    data = _read()
    parts = [
        f"Project: {data.get('project', 'unknown')}",
        "",
        "Project rules:",
    ]
    parts.extend(f"- {r}" for r in data.get("rules", []))
    if data.get("facts"):
        parts.append("")
        parts.append("Project memory:")
        parts.extend(f"- {f[:500]}" for f in data["facts"])
    return "\n".join(parts)


def cache_key() -> str:
    """Stable hash of the prefix for prompt-prefix caching."""
    return "kimi-" + hashlib.sha256(system_prefix().encode()).hexdigest()[:16]


def memory_path() -> Path:
    return config.MEMORY_PATH
