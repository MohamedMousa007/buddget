"""Runtime hooks. Set by the TUI to redirect IO; ignored in plain CLI."""

from __future__ import annotations

from typing import Any, Callable, Optional

# propose_plan(plan_dict) → "approved" | "rejected[: …]" | "revise: …"
PLAN_HOOK: Optional[Callable[[dict[str, Any]], str]] = None

# tool_called(name, args_repr) → None
TOOL_HOOK: Optional[Callable[[str, str], None]] = None

# stream_token(content_delta) → None
STREAM_HOOK: Optional[Callable[[str], None]] = None


def set_plan_hook(fn: Optional[Callable[[dict[str, Any]], str]]) -> None:
    global PLAN_HOOK
    PLAN_HOOK = fn


def set_tool_hook(fn: Optional[Callable[[str, str], None]]) -> None:
    global TOOL_HOOK
    TOOL_HOOK = fn


def set_stream_hook(fn: Optional[Callable[[str], None]]) -> None:
    global STREAM_HOOK
    STREAM_HOOK = fn
