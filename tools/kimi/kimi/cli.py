"""Kimi CLI — Typer entrypoint."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.prompt import Confirm, Prompt
from rich.table import Table

from kimi import __version__, config, memory
from kimi.agents.base import Agent
from kimi.agents.chat import chat as run_chat
from kimi.agents.engineer import engineer as run_engineer
from kimi.agents.swarm import swarm as run_swarm_orchestrator
from kimi.catalog import SWARM_AGENTS, SYNTHESIZER, get as get_agents, list_names

app = typer.Typer(
    add_completion=True,
    no_args_is_help=True,
    help="Kimi CLI — Cursor / Claude-Code-style agent for Buddget.",
    rich_markup_mode="rich",
)
console = Console()


@app.callback()
def _main(version: bool = typer.Option(False, "--version", help="Show version and exit.")):
    if version:
        console.print(f"kimi {__version__} · model {config.MODEL} · vision {config.VISION_MODEL}")
        raise typer.Exit()


# ─── doctor ──────────────────────────────────────────────────────────

@app.command()
def doctor() -> None:
    """Check API key, ripgrep, git, branches. Returns OK / list of issues."""
    issues: list[str] = []
    # API key
    try:
        from kimi.secrets import get_api_key

        get_api_key()
        console.print("[green]✓[/green] API key resolved")
    except Exception as e:  # noqa: BLE001
        console.print(f"[red]✗[/red] API key: {e}")
        issues.append("api-key")

    # ripgrep
    import shutil

    if shutil.which("rg"):
        console.print("[green]✓[/green] ripgrep installed")
    else:
        console.print("[red]✗[/red] ripgrep missing — `brew install ripgrep`")
        issues.append("ripgrep")

    # git remote + branches
    try:
        from kimi.tools import git

        b = git.current_branch()
        console.print(f"[green]✓[/green] git: branch `{b}`")
    except Exception as e:  # noqa: BLE001
        console.print(f"[red]✗[/red] git: {e}")
        issues.append("git")

    # quick smoke test of the model
    try:
        from kimi import client as _client

        _client.client().chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": "Reply with the single word OK."}],
            max_tokens=4,
        )
        console.print(f"[green]✓[/green] {config.MODEL} reachable")
    except Exception as e:  # noqa: BLE001
        console.print(f"[red]✗[/red] {config.MODEL} unreachable: {e}")
        issues.append("model")

    memory.bootstrap()
    console.print(f"[green]✓[/green] memory at {config.MEMORY_PATH}")

    if issues:
        console.print(f"[yellow]issues: {', '.join(issues)}[/yellow]")
        raise typer.Exit(code=1)
    console.print("[bold green]all green[/bold green]")


# ─── chat ────────────────────────────────────────────────────────────

@app.command()
def chat(
    message: Optional[str] = typer.Argument(None, help="One-shot first message; omit for full interactive."),
    image: Optional[Path] = typer.Option(None, "--image", "-i", help="Attach an image file (uses VL model)."),
    clip: bool = typer.Option(False, "--clip", help="Attach the current clipboard image (macOS)."),
    screenshot: bool = typer.Option(False, "--screenshot", "-s", help="Take an interactive screenshot to attach."),
) -> None:
    """Cursor-style chat. Streams responses, accepts /file /clear /save /cost /exit."""
    config.ensure_dirs()
    memory.bootstrap()

    image_path: Optional[str] = None
    if image:
        image_path = str(image.resolve())
    elif clip:
        from kimi.tools.vision import from_clipboard

        image_path = from_clipboard()
        if not image_path:
            console.print("[red]no image in clipboard[/red]")
            raise typer.Exit(code=1)
    elif screenshot:
        from kimi.tools.vision import screenshot_interactive

        image_path = screenshot_interactive()
        if not image_path:
            console.print("[red]screenshot failed or cancelled[/red]")
            raise typer.Exit(code=1)

    initial = message
    if image_path:
        from kimi.client import vision_describe

        console.print(f"[dim]→ describing image via {config.VISION_MODEL}…[/dim]")
        desc = vision_describe(image_path, hint=message or "")
        prefix = f"[image: {Path(image_path).name}]\n{desc}\n\n"
        initial = prefix + (message or "What should I notice or improve about this image?")

    run_chat(initial)


# ─── engineer ────────────────────────────────────────────────────────

@app.command()
def engineer(
    task: str = typer.Argument(..., help="What you want done. Be specific."),
    auto_approve: bool = typer.Option(True, "--auto-approve/--ask", help="Skip per-commit confirmation."),
    max_attempts: int = typer.Option(4, "--max-attempts", help="Max verify-fix retries."),
) -> None:
    """Autonomous engineer mode — plan, edit, verify, commit. Pushes are manual via `kimi push`."""
    memory.bootstrap()
    run_engineer(task, auto_approve=auto_approve, max_attempts=max_attempts)


# ─── swarm ───────────────────────────────────────────────────────────

@app.command()
def swarm(
    agents: list[str] = typer.Argument(..., help="Agent names. Use `kimi swarm-list` to see all."),
    prompt: str = typer.Option(..., "--prompt", "-p", help="The shared prompt for the swarm."),
    collaborative: bool = typer.Option(False, "--collab", help="Sequential mode where each agent sees prior outputs."),
    no_synth: bool = typer.Option(False, "--no-synth", help="Skip the final synthesizer pass."),
) -> None:
    """Run a swarm of named agents on one prompt. Outputs land in .kimi/sessions/."""
    memory.bootstrap()
    selected = get_agents(agents)
    synth = None if no_synth else SYNTHESIZER
    run_swarm_orchestrator(selected, prompt, collaborative=collaborative, synthesizer=synth)


@app.command("swarm-list")
def swarm_list() -> None:
    """List every named swarm agent."""
    table = Table(title="Swarm agents")
    table.add_column("name", style="cyan")
    table.add_column("role")
    for n, a in SWARM_AGENTS.items():
        table.add_row(n, a.role)
    table.add_row("synthesizer", SYNTHESIZER.role, style="bold")
    console.print(table)


# ─── review ──────────────────────────────────────────────────────────

@app.command()
def review() -> None:
    """Run the canonical pre-merge sweep on the current diff."""
    memory.bootstrap()
    from kimi.tools.git import diff as git_diff

    diff_text = git_diff(staged=False)
    if not diff_text.strip():
        console.print("[dim]no working-tree diff[/dim]")
        return
    selected = get_agents(["onboarding-coherence", "budget-sync-checker", "copy-tone", "secret-scan"])
    run_swarm_orchestrator(
        selected,
        f"Review this working-tree diff and flag issues:\n\n{diff_text[:30000]}",
        collaborative=False,
        synthesizer=SYNTHESIZER,
    )


# ─── push ────────────────────────────────────────────────────────────

@app.command()
def push(
    to_main: bool = typer.Option(False, "--to-main", help="Target main instead of dev (requires KIMI_ALLOW_MAIN=1)."),
) -> None:
    """Push current HEAD. Defaults to dev. Pushing to main requires explicit flag + env."""
    from kimi.tools import git

    if to_main:
        if not config.ALLOW_MAIN:
            console.print(
                "[red]refused: pushing to main requires KIMI_ALLOW_MAIN=1 in your shell.\n"
                "  KIMI_ALLOW_MAIN=1 kimi push --to-main[/red]"
            )
            raise typer.Exit(code=1)
        if not Confirm.ask(f"push HEAD to origin/{config.MAIN_BRANCH}?"):
            raise typer.Exit(code=1)
        out = git.push(config.MAIN_BRANCH, allow_main=True)
    else:
        out = git.push(config.DEV_BRANCH, allow_main=False)
    console.print(out)


# ─── memory ──────────────────────────────────────────────────────────

@app.command()
def memory_show() -> None:
    """Show project memory."""
    memory.bootstrap()
    import json

    console.print_json(json.dumps(memory.load()))


@app.command()
def memory_remember(fact: str = typer.Argument(..., help="A fact to add.")) -> None:
    """Add a fact to project memory."""
    memory.bootstrap()
    memory.remember(fact)
    console.print(f"[green]remembered.[/green]")


# ─── cost ────────────────────────────────────────────────────────────

def _cost_summary() -> str:
    if not config.USAGE_CSV.exists():
        return "(no usage logged yet)"
    rows = list(csv.DictReader(open(config.USAGE_CSV)))
    if not rows:
        return "(no usage logged yet)"
    total_in = sum(int(r["prompt_tokens"]) for r in rows)
    total_out = sum(int(r["completion_tokens"]) for r in rows)
    total_cost = sum(float(r["cost_usd"]) for r in rows)
    return (
        f"sessions: {len(rows)}\n"
        f"input tokens:  {total_in:>10,}\n"
        f"output tokens: {total_out:>10,}\n"
        f"total cost:    ${total_cost:.4f}"
    )


@app.command()
def cost() -> None:
    """Token + dollar usage summary."""
    console.print(_cost_summary())
