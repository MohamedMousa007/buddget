"""Autonomous engineer mode — investigate → plan → execute → verify → commit.

Built-in error recovery: if `verify` fails, the agent automatically gets the
failing output as a follow-up tool result and re-enters the loop to fix it.
The loop runs until `verify` returns ALL_GREEN or max_attempts is hit.
"""

from __future__ import annotations

import json
import time

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm

from kimi import config, memory
from kimi.agents.base import Agent
from kimi.agents.loop import run as run_loop
from kimi.tools import git, verify

ENGINEER_SYSTEM = """You are an autonomous senior engineer working on the Buddget Next.js + Supabase app.

Your task is given by the user. Carry it out end-to-end:
1. Investigate the codebase using `ripgrep` + targeted `read_file`. Cite file:line.
2. Make minimal, surgical changes via `edit_file` or `write_file`.
3. After changes, ALWAYS call `verify` (runs lint + tsc + vitest + next build with dummy Supabase env).
4. If `verify` fails, read the captured output, fix the cause, and call `verify` again. Repeat until ALL_GREEN.
5. When green, `git_add .` then `git_commit "<concise imperative message>"`.
6. Return a one-paragraph summary of what changed and why.

Hard rules:
- Do NOT push. Pushing is a separate `kimi push` step the user runs manually.
- Refuse to commit if secrets show up in the diff.
- Keep token usage low: ripgrep over reading whole files; never re-read.
- No filler prose. Diff and commit messages are the deliverables.
"""


def engineer(task: str, *, auto_approve: bool = True, max_attempts: int = 4) -> None:
    console = Console()
    config.ensure_dirs()
    agent = Agent(name="engineer", role="autonomous senior engineer", system_prompt=ENGINEER_SYSTEM, write=True)

    console.print(Panel.fit(f"[bold]engineer mode[/bold]: {task}", border_style="green"))

    session_id = f"eng-{int(time.time())}"
    session_path = config.SESSIONS_DIR / f"{session_id}.jsonl"

    history: list[dict[str, str]] = [{"role": "user", "content": task}]

    for attempt in range(1, max_attempts + 1):
        console.print(f"[dim]── attempt {attempt}/{max_attempts} ──[/dim]")
        final = run_loop(agent, history, max_steps=32)
        with open(session_path, "a") as f:
            for m in final:
                f.write(json.dumps(m, default=str) + "\n")

        # Check whether the agent already verified. If not, run verify now and feed back.
        results = verify.run_all()
        if verify.all_passed(results):
            console.print("[green]✓ verify ALL_GREEN[/green]")
            break
        # Surface the failing step back to the agent for the next attempt.
        failing = next(((step, out) for step, (code, out) in results.items() if code != 0), None)
        if failing:
            step_name, out = failing
            console.print(f"[yellow]✗ {step_name} failed; feeding back for autonomous fix[/yellow]")
            history = [
                *final,
                {
                    "role": "user",
                    "content": (
                        f"Verification step `{step_name}` failed after your changes. Output:\n\n{out}\n\n"
                        f"Diagnose and fix the cause. Then call `verify` again."
                    ),
                },
            ]
        else:
            break
    else:
        console.print(f"[red]exited engineer mode without ALL_GREEN after {max_attempts} attempts[/red]")
        return

    # Show final diff before committing if not already committed.
    diff = git.diff(staged=False)
    if diff.strip():
        console.print("[yellow]worktree still has uncommitted changes; staging + committing now.[/yellow]")
        from kimi.tools import git as git_tools

        if auto_approve or Confirm.ask("commit these changes?"):
            git_tools.add(".")
            git_tools.commit(f"chore(kimi): {task[:60]}")
    console.print("[green]done. Use `kimi push` to push to dev.[/green]")
    memory.remember(f"engineer task completed: {task[:160]}")
