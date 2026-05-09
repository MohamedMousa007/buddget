"""Unified router-chat. The single entrypoint for `kimi`.

The agent decides on its own whether to:
  - Answer a trivial question directly (read tools only).
  - Propose a plan and wait for user approval before any non-trivial work.
  - Spawn a swarm of named agents for multi-perspective audits.
  - Edit code, run verify, and commit (after approval).
  - Pull in a screenshot/clipboard image via the vision tool.

Subcommands like `kimi doctor`, `kimi push`, `kimi cost` are still available as
direct escape hatches — but you almost never need them; just describe what you
want in chat and the agent routes itself.
"""

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

ROUTER_SYSTEM = """You are Kimi, a senior engineer working in the user's terminal on the Buddget app.
You are the SINGLE entrypoint — the user never picks subcommands. You decide the workflow.

# Routing rules

For each user turn, choose exactly one path:

1. **Trivial read-only question** ("what does X do?", "where is Y?", "show me Z")
   → Use ripgrep / read_file / git_diff to answer in 1-3 sentences with file:line citations.
   → Do NOT call propose_plan. Do NOT spawn a swarm.

2. **Anything that edits code, audits multiple files, runs CI, or commits**
   → FIRST call `propose_plan` with a structured plan. Wait for the user's response.
     - "approved": execute the plan exactly. Run verify after edits. Commit when green.
     - "rejected[: reason]": stop. Acknowledge and offer to adjust.
     - "revise: <feedback>": revise the plan and call `propose_plan` again.
   → Never start editing or swarm-spawning before approval.

3. **Multi-perspective audits** (e.g. "review this onboarding change", "is the budget math consistent?")
   → Pick 2-5 relevant agents from the catalog and call `run_swarm` (after approval).
     Catalog: onboarding-coherence, budget-sync-checker, rls-auditor, schema-drift,
     i18n-coverage, dead-code, tutorial-stability, prompt-tuner, a11y, bundle-size,
     copy-tone, test-gap, secret-scan.

4. **User attaches/mentions an image, screenshot, or clipboard content**
   → Call `vision_attach` with the right `source`. Then proceed with normal routing.

# Plan shape (for `propose_plan`)

- title: terse imperative.
- summary: why this change, in 1-3 sentences.
- steps: numbered, granular. Each step references the tool you'll use.
- files_to_touch: paths the agent will read or write.
- needs_swarm + swarm_agents: only when picking a swarm.
- will_verify: true if running lint+tsc+test+build after edits.
- will_commit: true if creating a commit (note: never push — push is a separate manual step).
- risks: candid flags, including any irreversible writes.

# Hard constraints

- ALWAYS prefer ripgrep over read_file. Never re-read a file you've already read this turn.
- Never push. The user runs `kimi push` themselves.
- Refuse to commit if you see secrets in the diff (the secret-scan tool guards this anyway).
- Be terse. No preambles, no recap of the user's request, no closing pleasantries.
- File:line citations on every claim about code.
"""


def chat(initial_message: str | None = None) -> None:
    console = Console()
    config.ensure_dirs()
    agent = Agent(name="kimi", role="senior engineer (router)", system_prompt=ROUTER_SYSTEM, write=True)

    session_id = f"chat-{int(time.time())}"
    session_path = config.SESSIONS_DIR / f"{session_id}.jsonl"

    history: list[dict[str, str]] = []

    console.print(
        Panel.fit(
            f"[bold]kimi[/bold] · {config.MODEL} · session [cyan]{session_id}[/cyan]\n"
            f"[dim]describe what you want — kimi picks the workflow.\n"
            f"slashes: /attach <path>  /clip  /shot  /clear  /save  /cost  /exit[/dim]",
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
            keep_going = _handle_slash(user_in, history, session_path, console, agent)
            if not keep_going:
                break
            continue
        history.append({"role": "user", "content": user_in})
        run_one(agent, history, session_path)


def run_one(agent: Agent, history: list[dict[str, str]], session_path: Path) -> None:
    final = run_loop(agent, history)
    with open(session_path, "a") as f:
        for m in final[len(history):]:
            f.write(json.dumps(m, default=str) + "\n")
    last_assistant = next((m for m in reversed(final) if m.get("role") == "assistant" and m.get("content")), None)
    if last_assistant:
        history.append({"role": "assistant", "content": last_assistant["content"]})


def _handle_slash(line: str, history: list[dict[str, str]], session_path: Path, console: Console, agent: Agent) -> bool:
    parts = line.strip().split(maxsplit=1)
    cmd = parts[0]
    arg = parts[1] if len(parts) > 1 else ""
    if cmd in {"/exit", "/quit"}:
        return False
    if cmd == "/clear":
        history.clear()
        console.print("[dim]history cleared[/dim]")
        return True
    if cmd == "/attach":
        from kimi.tools import fs

        text = fs.read_file(arg)
        history.append({"role": "user", "content": f"[attached file]\n{text}"})
        console.print(f"[dim]attached {arg}[/dim]")
        return True
    if cmd == "/clip":
        from kimi.client import vision_describe
        from kimi.tools.vision import from_clipboard

        path = from_clipboard()
        if not path:
            console.print("[red]no image in clipboard[/red]")
            return True
        console.print(f"[dim]→ describing image via {config.VISION_MODEL}…[/dim]")
        desc = vision_describe(path)
        history.append({"role": "user", "content": f"[clipboard image]\n{desc}"})
        return True
    if cmd == "/shot":
        from kimi.client import vision_describe
        from kimi.tools.vision import screenshot_interactive

        path = screenshot_interactive()
        if not path:
            console.print("[red]screenshot cancelled[/red]")
            return True
        console.print(f"[dim]→ describing image via {config.VISION_MODEL}…[/dim]")
        desc = vision_describe(path)
        history.append({"role": "user", "content": f"[screenshot]\n{desc}"})
        return True
    if cmd == "/save":
        console.print(f"[dim]session at {session_path}[/dim]")
        return True
    if cmd == "/cost":
        from kimi.cli import _cost_summary

        console.print(_cost_summary())
        return True
    console.print(f"[red]unknown slash: {cmd}[/red]")
    return True
