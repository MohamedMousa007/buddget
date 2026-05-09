"""Interactive chat (Cursor-mode). Streams responses, accepts /commands."""

from __future__ import annotations

import json
import time
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt

from kimi import config
from kimi.agents.base import Agent
from kimi.agents.loop import run as run_loop

CHAT_SYSTEM = """You are Kimi, a senior software engineer assistant for the Buddget project.
You are running inside the user's terminal with file/git/shell access. Be terse, factual, and link to file:line citations.

Token economy:
- ALWAYS prefer `ripgrep` over `read_file` for "find code about X". Read targeted line ranges only.
- Do not re-read files you already read this session.
- Run shell commands sparingly.

Style: short answers. No preambles. No "Here's what I found:" framing.
"""


def chat(initial_message: str | None = None) -> None:
    console = Console()
    config.ensure_dirs()
    agent = Agent(name="kimi", role="senior engineer", system_prompt=CHAT_SYSTEM, write=True)

    session_id = f"chat-{int(time.time())}"
    session_path = config.SESSIONS_DIR / f"{session_id}.jsonl"

    history: list[dict[str, str]] = []

    console.print(
        Panel.fit(
            f"[bold]kimi chat[/bold] · {config.MODEL} · session [cyan]{session_id}[/cyan]\n"
            f"[dim]/file <path>  /clear  /save  /cost  /exit[/dim]",
            border_style="cyan",
        )
    )

    if initial_message:
        history.append({"role": "user", "content": initial_message})
        run_one(agent, history, session_path)

    while True:
        try:
            user_in = Prompt.ask("[bold cyan]you[/bold cyan]")
        except (EOFError, KeyboardInterrupt):
            console.print()
            break
        if not user_in.strip():
            continue
        if user_in.startswith("/"):
            if not _handle_slash(user_in, history, session_path, console):
                break
            continue
        history.append({"role": "user", "content": user_in})
        run_one(agent, history, session_path)


def run_one(agent: Agent, history: list[dict[str, str]], session_path: Path) -> None:
    final = run_loop(agent, history)
    # Strip tool calls/results from the persisted user-facing history; keep them in session log only.
    with open(session_path, "a") as f:
        for m in final[len(history):]:
            f.write(json.dumps(m, default=str) + "\n")
    # Replace history with the final assistant message only (token economy).
    last_assistant = next((m for m in reversed(final) if m.get("role") == "assistant" and m.get("content")), None)
    if last_assistant:
        history.append({"role": "assistant", "content": last_assistant["content"]})


def _handle_slash(line: str, history: list[dict[str, str]], session_path: Path, console: Console) -> bool:
    parts = line.strip().split(maxsplit=1)
    cmd = parts[0]
    arg = parts[1] if len(parts) > 1 else ""
    if cmd in {"/exit", "/quit"}:
        return False
    if cmd == "/clear":
        history.clear()
        console.print("[dim]history cleared[/dim]")
        return True
    if cmd == "/file":
        try:
            from kimi.tools import fs

            text = fs.read_file(arg)
            history.append({"role": "user", "content": f"[attached file]\n{text}"})
            console.print(f"[dim]attached {arg}[/dim]")
        except Exception as e:  # noqa: BLE001
            console.print(f"[red]{e}[/red]")
        return True
    if cmd == "/save":
        console.print(f"[dim]session at {session_path}[/dim]")
        return True
    if cmd == "/cost":
        from kimi.cli import _cost_summary

        console.print(_cost_summary())
        return True
    console.print(f"[red]unknown command: {cmd}[/red]")
    return True
