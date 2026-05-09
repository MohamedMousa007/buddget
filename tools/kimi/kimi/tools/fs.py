"""Filesystem tools — read, write, edit (string-replace), glob.

Token-cheap defaults: read returns line ranges by default, not whole files.
"""

from __future__ import annotations

import fnmatch
from pathlib import Path

from kimi import config
from kimi.policy import can_write, scan_for_secrets


def _resolve(path: str) -> Path:
    p = (config.PROJECT_ROOT / path).resolve()
    if not str(p).startswith(str(config.PROJECT_ROOT)):
        raise ValueError(f"refused: path `{path}` escapes project root")
    return p


def read_file(path: str, start_line: int = 1, end_line: int | None = None) -> str:
    """Read a file or a line range. 1-indexed, inclusive."""
    p = _resolve(path)
    if not p.exists():
        return f"<file not found: {path}>"
    text = p.read_text(errors="replace")
    lines = text.splitlines()
    end = end_line or len(lines)
    sliced = lines[max(0, start_line - 1) : end]
    numbered = "\n".join(f"{i + start_line:>5}  {line}" for i, line in enumerate(sliced))
    return f"# {path} (lines {start_line}-{start_line + len(sliced) - 1} of {len(lines)})\n{numbered}"


def write_file(path: str, content: str, allow_migration: bool = False) -> str:
    p = _resolve(path)
    ok, why = can_write(p, allow_migration=allow_migration)
    if not ok:
        return why
    secrets = scan_for_secrets(content)
    if secrets:
        return f"refused: content contains likely secrets: {secrets}"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
    return f"wrote {len(content)} bytes to {path}"


def edit_file(path: str, old_string: str, new_string: str, replace_all: bool = False) -> str:
    """Exact string replace. Refuses if `old_string` is not unique (unless replace_all)."""
    p = _resolve(path)
    if not p.exists():
        return f"<file not found: {path}>"
    text = p.read_text()
    count = text.count(old_string)
    if count == 0:
        return f"refused: old_string not found in {path}"
    if count > 1 and not replace_all:
        return f"refused: old_string occurs {count} times in {path}; pass replace_all=true or include more context"
    secrets = scan_for_secrets(new_string)
    if secrets:
        return f"refused: new_string contains likely secrets: {secrets}"
    new = text.replace(old_string, new_string) if replace_all else text.replace(old_string, new_string, 1)
    p.write_text(new)
    return f"edited {path} ({count} replacement{'s' if count != 1 else ''})"


def list_dir(path: str = ".") -> str:
    p = _resolve(path)
    if not p.exists():
        return f"<dir not found: {path}>"
    entries = []
    for child in sorted(p.iterdir()):
        marker = "/" if child.is_dir() else ""
        entries.append(f"{child.name}{marker}")
    return "\n".join(entries) or "(empty)"


def glob(pattern: str, max_results: int = 200) -> str:
    """Glob recursively. Returns paths relative to project root."""
    root = config.PROJECT_ROOT
    matches: list[str] = []
    for p in root.rglob("*"):
        if p.is_file() and fnmatch.fnmatch(str(p.relative_to(root)), pattern):
            matches.append(str(p.relative_to(root)))
            if len(matches) >= max_results:
                break
    return "\n".join(matches) or "(no matches)"
