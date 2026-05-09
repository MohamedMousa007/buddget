"""Ripgrep wrapper. The cheap-token alternative to whole-file reads."""

from __future__ import annotations

import shlex
import subprocess

from kimi import config


def ripgrep(query: str, path: str = ".", max_results: int = 80, file_type: str | None = None) -> str:
    """Run ripgrep and return file:line:match lines (with 2 lines of context)."""
    cmd = [
        "rg",
        "--no-heading",
        "--line-number",
        "--color=never",
        "--max-count=10",
        "-C",
        "1",
        query,
        path,
    ]
    if file_type:
        cmd[1:1] = ["-t", file_type]
    try:
        out = subprocess.run(
            cmd,
            cwd=config.PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except FileNotFoundError:
        return "ripgrep not installed; install via `brew install ripgrep`"
    except subprocess.TimeoutExpired:
        return "ripgrep timed out"
    lines = (out.stdout or "").splitlines()
    if not lines:
        return f"(no matches for `{query}`)"
    # Cap to keep token cost predictable.
    if len(lines) > max_results:
        lines = lines[:max_results] + [f"… and {len(lines) - max_results} more"]
    return "\n".join(lines)
