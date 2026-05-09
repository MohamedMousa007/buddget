"""Resolve the Moonshot API key.

Order:
  1. `KIMI_API_KEY` env var (loaded by config.py from .env.kimi)
  2. macOS Keychain item `kimi-api-key`
"""

from __future__ import annotations

import os
import subprocess


def get_api_key() -> str:
    env = os.getenv("KIMI_API_KEY", "").strip()
    if env:
        return env

    # macOS Keychain fallback.
    try:
        out = subprocess.run(
            ["security", "find-generic-password", "-s", "kimi-api-key", "-w"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if out.returncode == 0:
            return out.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    raise RuntimeError(
        "No Kimi API key found. Set KIMI_API_KEY in .env.kimi or "
        "store it in macOS Keychain via:\n"
        '  security add-generic-password -a "$USER" -s kimi-api-key -w'
    )
