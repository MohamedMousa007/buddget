"""Bounded subprocess executor."""

from __future__ import annotations

import shlex
import subprocess

from kimi import config

# Soft denylist; refuse outright on these.
HARD_BLOCK = (
    "rm -rf /",
    ":(){ :|:& };:",
    "mkfs",
    "dd if=",
    "shutdown",
    "reboot",
)


def run(cmd: str, timeout: int = 180, cwd: str | None = None) -> str:
    if any(b in cmd for b in HARD_BLOCK):
        return f"refused: command contains a hard-blocked pattern"
    try:
        out = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd or str(config.PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return f"<timed out after {timeout}s>"
    stdout = (out.stdout or "")[-8000:]  # cap returned output
    stderr = (out.stderr or "")[-4000:]
    head = f"[exit {out.returncode}]"
    parts = [head]
    if stdout.strip():
        parts.append("--- stdout ---\n" + stdout)
    if stderr.strip():
        parts.append("--- stderr ---\n" + stderr)
    return "\n".join(parts)
