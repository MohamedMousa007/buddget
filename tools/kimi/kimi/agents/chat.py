"""Unified router-chat. The single entrypoint for `kimi`.

The agent decides on its own whether to:
  - Answer a trivial question directly (read tools only).
  - Propose a plan (plan mode) and wait for approval before non-trivial work.
  - In direct mode, execute non-destructive edits without proposing first.
  - Spawn a swarm of named agents for multi-perspective audits.
  - Edit code, run verify, and commit.
  - Pull in a screenshot/clipboard image via the vision tool.

Inside the chat: a Rich status bar at the top, slash commands for model/mode/
push/pull/sync/status. Subcommands (`kimi doctor`, `kimi push`, ...) are still
direct escape hatches.
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
from kimi.ui.statusbar import KNOWN_MODELS, SessionState, behind_summary, render, update_branch_state

ROUTER_SYSTEM_PLAN = """You are Kimi, a senior engineer working in the user's terminal on the Buddget app.
You are the SINGLE entrypoint — the user never picks subcommands. You decide the workflow.

# Routing rules (PLAN mode)

For each user turn, choose exactly one path:

1. **Trivial read-only question** → answer directly with read tools. No plan.
2. **Anything that edits code, audits multiple files, runs CI, or commits**
   → FIRST call `propose_plan` with a structured plan. Wait for the user's response.
     - "approved": execute the plan. Run verify after edits. Commit when green.
     - "rejected[: reason]": stop. Acknowledge and offer to adjust.
     - "revise: <feedback>": revise the plan and call `propose_plan` again.
3. **Multi-perspective audits** → pick 2-5 catalog agents and call `run_swarm` (after approval).
4. **User mentions an image / screenshot / clipboard** → call `vision_attach` first.

# Plan shape (for `propose_plan`)

- title (terse imperative), summary (1-3 sentences), steps[], files_to_touch[],
  needs_swarm + swarm_agents[], will_verify, will_commit, risks[].

# Hard constraints

- ALWAYS prefer ripgrep over read_file. Never re-read.
- Never push. Push is a separate manual step.
- Refuse to commit if you see secrets in the diff.
- Be terse. No preambles.
"""

ROUTER_SYSTEM_DIRECT = """You are Kimi, a senior engineer in the user's terminal on the Buddget app.
You are the SINGLE entrypoint. You decide the workflow.

# Routing rules (DIRECT mode)

In direct mode you SKIP `propose_plan` for routine code edits, audits, swarms, and commits.
Just execute. Still call `propose_plan` BEFORE these high-risk actions:

- Pushing (any branch).
- Deleting files or directories.
- Mass renames or migrations (`supabase/migrations/`).
- Anything irreversible.

For multi-perspective audits, just call `run_swarm` directly with the right agents.

# Hard constraints

- ALWAYS prefer ripgrep over read_file. Never re-read.
- Never push. Push is a separate manual step.
- Refuse to commit if you see secrets in the diff.
- After every edit batch, call `verify`. On failure, fix the cause and re-run verify.
- Be terse. No preambles.
"""


def _system(mode: str) -> str:
    return ROUTER_SYSTEM_PLAN if mode == "plan" else ROUTER_SYSTEM_DIRECT


def chat(initial_message: str | None = None) -> None:
    console = Console()
    config.ensure_dirs()

    state = SessionState(model=config.MODEL, mode="plan", push_targets=("dev",))
    update_branch_state(state, fetch=True)

    agent = Agent(name="kimi", role="senior engineer (router)", system_prompt=_system(state.mode), write=True, model=state.model)

    session_id = f"chat-{int(time.time())}"
    session_path = config.SESSIONS_DIR / f"{session_id}.jsonl"

    history: list[dict[str, str]] = []

    render(state, console)
    console.print(
        "[dim]"
        "/model · /mode plan|direct · /push dev|main|both · /pull · /status · /sync · "
        "/attach <path> · /clip · /shot · /clear · /save · /cost · /refresh · /exit"
        "[/dim]"
    )

    if initial_message:
        history.append({"role": "user", "content": initial_message})
        agent = run_one(agent, state, history, session_path, console)

    while True:
        try:
            user_in = Prompt.ask("[bold cyan]you[/bold cyan]")
        except (EOFError, KeyboardInterrupt):
            console.print()
            break
        if not user_in.strip():
            continue
        if user_in.startswith("/"):
            keep, agent = _handle_slash(user_in, history, session_path, console, agent, state)
            if not keep:
                break
            continue
        history.append({"role": "user", "content": user_in})
        agent = run_one(agent, state, history, session_path, console)


def run_one(agent: Agent, state: SessionState, history: list[dict[str, str]], session_path: Path, console: Console) -> Agent:
    final = run_loop(agent, history)
    with open(session_path, "a") as f:
        for m in final[len(history):]:
            f.write(json.dumps(m, default=str) + "\n")
    last_assistant = next((m for m in reversed(final) if m.get("role") == "assistant" and m.get("content")), None)
    if last_assistant:
        history.append({"role": "assistant", "content": last_assistant["content"]})
        usage = last_assistant.get("usage") or {}
        state.session_in += int(usage.get("in", 0))
        state.session_out += int(usage.get("out", 0))
        state.session_cost = (
            state.session_in * config.PRICE_INPUT_PER_M / 1_000_000
            + state.session_out * config.PRICE_OUTPUT_PER_M / 1_000_000
        )
    update_branch_state(state, fetch=False)
    render(state, console)
    return agent


def _handle_slash(line: str, history: list[dict[str, str]], session_path: Path, console: Console, agent: Agent, state: SessionState) -> tuple[bool, Agent]:
    parts = line.strip().split(maxsplit=1)
    cmd = parts[0]
    arg = parts[1].strip() if len(parts) > 1 else ""

    if cmd in {"/exit", "/quit"}:
        return False, agent

    if cmd == "/clear":
        history.clear()
        console.print("[dim]history cleared[/dim]")
        return True, agent

    if cmd == "/refresh":
        update_branch_state(state, fetch=True)
        render(state, console)
        return True, agent

    if cmd == "/model":
        choice = arg or _pick_model(console)
        if choice:
            state.model = choice
            agent = Agent(name=agent.name, role=agent.role, system_prompt=_system(state.mode), write=True, model=choice)
            console.print(f"[green]model → {choice}[/green]")
            render(state, console)
        return True, agent

    if cmd == "/mode":
        new_mode = arg or ("direct" if state.mode == "plan" else "plan")
        if new_mode not in {"plan", "direct"}:
            console.print("[red]/mode plan | direct[/red]")
            return True, agent
        state.mode = new_mode
        agent = Agent(name=agent.name, role=agent.role, system_prompt=_system(state.mode), write=True, model=state.model)
        console.print(f"[green]mode → {new_mode}[/green]")
        render(state, console)
        return True, agent

    if cmd == "/push":
        return _slash_push(arg, console, state), agent

    if cmd == "/pull":
        from kimi.tools import git as git_tools

        for branch in (config.DEV_BRANCH, config.MAIN_BRANCH):
            console.print(git_tools.pull(branch))
        update_branch_state(state, fetch=True)
        render(state, console)
        return True, agent

    if cmd == "/status":
        update_branch_state(state, fetch=True)
        render(state, console)
        behind_summary(console)
        return True, agent

    if cmd == "/sync":
        return _slash_sync(arg, console, state), agent

    if cmd == "/attach":
        from kimi.tools import fs

        text = fs.read_file(arg)
        history.append({"role": "user", "content": f"[attached file]\n{text}"})
        console.print(f"[dim]attached {arg}[/dim]")
        return True, agent

    if cmd == "/clip":
        return _slash_image("clipboard", history, console), agent

    if cmd == "/shot":
        return _slash_image("screenshot", history, console), agent

    if cmd == "/save":
        console.print(f"[dim]session at {session_path}[/dim]")
        return True, agent

    if cmd == "/cost":
        from kimi.cli import _cost_summary

        console.print(_cost_summary())
        return True, agent

    console.print(f"[red]unknown slash: {cmd}[/red]")
    return True, agent


def _pick_model(console: Console) -> str | None:
    console.print("[bold]available models[/bold] (override in .env.kimi for anything beyond this)")
    for i, m in enumerate(KNOWN_MODELS, 1):
        console.print(f"  [cyan]{i}[/cyan]. {m}")
    raw = Prompt.ask("pick (number or name)", default="")
    if not raw.strip():
        return None
    if raw.isdigit() and 1 <= int(raw) <= len(KNOWN_MODELS):
        return KNOWN_MODELS[int(raw) - 1]
    return raw.strip()


def _slash_push(arg: str, console: Console, state: SessionState) -> bool:
    from kimi.tools import git as git_tools

    target = (arg or state.push_targets[0]).strip()
    if target == "both":
        targets = (config.DEV_BRANCH, config.MAIN_BRANCH)
    elif target in (config.DEV_BRANCH, config.MAIN_BRANCH):
        targets = (target,)
    else:
        console.print("[red]/push dev | main | both[/red]")
        return True

    if config.MAIN_BRANCH in targets:
        if not config.ALLOW_MAIN:
            console.print(
                f"[red]refused: pushing to {config.MAIN_BRANCH} requires KIMI_ALLOW_MAIN=1 in your shell.[/red]"
            )
            return True
        if not Prompt.ask(f"push HEAD to origin/{config.MAIN_BRANCH}?", choices=["y", "n"], default="n") == "y":
            return True

    out = git_tools.push_many(list(targets), allow_main=config.ALLOW_MAIN)
    console.print(out)
    state.push_targets = targets
    update_branch_state(state, fetch=True)
    render(state, console)
    return True


def _slash_sync(arg: str, console: Console, state: SessionState) -> bool:
    """Pull both branches, then push to the user's chosen target(s)."""
    from kimi.tools import git as git_tools

    console.print("[bold]sync[/bold] — pulling…")
    for branch in (config.DEV_BRANCH, config.MAIN_BRANCH):
        console.print(git_tools.pull(branch))

    target = (arg or "dev").strip()
    if target == "both":
        targets = (config.DEV_BRANCH, config.MAIN_BRANCH)
    elif target in (config.DEV_BRANCH, config.MAIN_BRANCH):
        targets = (target,)
    else:
        console.print("[red]/sync dev | main | both[/red]")
        return True

    if config.MAIN_BRANCH in targets and not config.ALLOW_MAIN:
        console.print(
            f"[yellow]skipping push to {config.MAIN_BRANCH} (set KIMI_ALLOW_MAIN=1 to enable)[/yellow]"
        )
        targets = tuple(t for t in targets if t != config.MAIN_BRANCH)

    if targets:
        console.print("[bold]sync[/bold] — pushing…")
        console.print(git_tools.push_many(list(targets), allow_main=config.ALLOW_MAIN))

    update_branch_state(state, fetch=True)
    render(state, console)
    return True


def _slash_image(source: str, history: list[dict[str, str]], console: Console) -> bool:
    from kimi.client import vision_describe
    from kimi.tools.vision import from_clipboard, screenshot_interactive

    path = from_clipboard() if source == "clipboard" else screenshot_interactive()
    if not path:
        console.print(f"[red]no image from {source}[/red]")
        return True
    console.print(f"[dim]→ describing image via {config.VISION_MODEL}…[/dim]")
    desc = vision_describe(path)
    history.append({"role": "user", "content": f"[{source} image]\n{desc}"})
    return True
