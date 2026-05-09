"""Vision input — screenshot / clipboard / path → dense text via VL model."""

from __future__ import annotations

import os
import subprocess
import tempfile
import time
from pathlib import Path


def screenshot_interactive() -> str | None:
    """macOS: prompt user to drag-select a region. Returns path to PNG."""
    out = Path(tempfile.gettempdir()) / f"kimi-shot-{int(time.time())}.png"
    try:
        subprocess.run(["screencapture", "-i", str(out)], check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        return None
    return str(out) if out.exists() and out.stat().st_size > 0 else None


def from_clipboard() -> str | None:
    """macOS clipboard → temp PNG via osascript. Returns path or None."""
    out = Path(tempfile.gettempdir()) / f"kimi-clip-{int(time.time())}.png"
    script = f'''
    set p to POSIX file "{out}"
    try
        set cdata to (the clipboard as «class PNGf»)
        set f to open for access p with write permission
        write cdata to f
        close access f
        return "ok"
    on error errMsg
        try
            close access p
        end try
        return "error: " & errMsg
    end try
    '''
    try:
        r = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=10)
        if r.stdout.strip() == "ok" and out.exists() and out.stat().st_size > 0:
            return str(out)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    return None
