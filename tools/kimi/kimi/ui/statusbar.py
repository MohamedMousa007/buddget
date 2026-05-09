"""Top status bar — model · mode · push target · branch state · cost.

Rendered once at session start and after any `/refresh` or state change.
Lightweight (one line of Rich markup) so it doesn't fight the streaming chat.
"""

from __future__ import annotations

from dataclasses import dataclass

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from kimi import config


@dataclass
class SessionState:
    model: str = ""
    mode: str = "plan"  # "plan" | "direct"
    push_targets: tuple[str, ...] = ("dev",)  # which branches `/push` will hit by default
    dev_ahead: int = 0
    dev_behind: int = 0
    main_ahead: int = 0
    main_behind: int = 0
    branch: str = "?"
    session_in: int = 0
    session_out: int = 0
    session_cost: float = 0.0


def render(state: SessionState, console: Console) -> None:
    push_label = "+".join(state.push_targets)
    mode_color = "green" if state.mode == "plan" else "yellow"
    dev_state = _branch_chip("dev", state.dev_ahead, state.dev_behind)
    main_state = _branch_chip("main", state.main_ahead, state.main_behind)
    cost_str = f"${state.session_cost:.4f} · {state.session_in + state.session_out:,} tok"
    line = (
        f"[bold]kimi[/bold]  "
        f"[cyan]model[/cyan] {state.model}  "
        f"[{mode_color}]mode[/{mode_color}] {state.mode}  "
        f"[magenta]push[/magenta] {push_label}  "
        f"[bold]branch[/bold] {state.branch}  "
        f"{dev_state}  {main_state}  "
        f"[dim]{cost_str}[/dim]"
    )
    console.print(Panel(line, border_style="cyan"))


def _branch_chip(name: str, ahead: int, behind: int) -> str:
    if ahead == 0 and behind == 0:
        return f"[green]{name} ✓[/green]"
    parts = []
    if ahead:
        parts.append(f"↑{ahead}")
    if behind:
        parts.append(f"↓{behind}")
    color = "yellow" if behind else "blue"
    return f"[{color}]{name} {' '.join(parts)}[/{color}]"


def update_branch_state(state: SessionState, *, fetch: bool = False) -> None:
    """Recompute ahead/behind for dev and main.

    `fetch=True` runs `git fetch --all` first (network call). Use only on
    explicit user actions (/refresh, /pull, /sync, /status, /push) — never
    on every chat turn, or every reply pays a network round-trip.
    """
    from kimi.tools import git as git_tools

    try:
        if fetch:
            git_tools.fetch_all()
        state.branch = git_tools.current_branch()
        state.dev_ahead, state.dev_behind = git_tools.ahead_behind(config.DEV_BRANCH)
        state.main_ahead, state.main_behind = git_tools.ahead_behind(config.MAIN_BRANCH)
    except Exception as e:  # noqa: BLE001
        state.branch = f"? ({e})"


def behind_summary(console: Console) -> None:
    """Print `git log` of commits we're behind on, for each branch."""
    from kimi.tools import git as git_tools

    git_tools.fetch_all()
    for branch in (config.DEV_BRANCH, config.MAIN_BRANCH):
        ahead, behind = git_tools.ahead_behind(branch)
        title = f"{branch}  ↑{ahead}  ↓{behind}"
        body = git_tools.commits_behind_summary(branch) if behind > 0 else "(up to date)"
        console.print(Panel(body, title=title, border_style="yellow" if behind else "green"))


# ─── known model presets (overridable in .env.kimi) ────────────────

KNOWN_MODELS: tuple[str, ...] = (
    "kimi-k2.6",
    "kimi-k2.6-thinking",
    "moonshot-v1-128k",
    "moonshot-v1-32k",
    "moonshot-v1-8k",
)
