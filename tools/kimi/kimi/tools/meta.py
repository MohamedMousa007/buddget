"""Meta-tools the router-agent uses to decide its own workflow.

These are how the agent calls back into Kimi infrastructure mid-conversation:
- `propose_plan` blocks for user y/N before any non-trivial work begins.
- `run_swarm` spawns a parallel multi-agent audit and returns synthesized output.
- `vision_attach` pulls in a screenshot/clipboard image without the user
  re-running the command.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt

console = Console()


def propose_plan(plan: dict[str, Any]) -> str:
    """Show the plan to the user, ask for approval. Return the user's decision.

    The agent calls this BEFORE doing anything non-trivial. The conversation
    pauses on stdin until the user answers, then the agent gets the answer
    as a tool result and proceeds (or revises).
    """
    title = plan.get("title", "Plan")
    summary = plan.get("summary", "")
    steps = plan.get("steps", []) or []
    files = plan.get("files_to_touch", []) or []
    risks = plan.get("risks", []) or []
    needs_swarm = plan.get("needs_swarm", False)
    swarm_agents = plan.get("swarm_agents", []) or []
    will_verify = plan.get("will_verify", False)
    will_commit = plan.get("will_commit", False)

    body_lines: list[str] = []
    if summary:
        body_lines.append(summary)
        body_lines.append("")
    if steps:
        body_lines.append("[bold]Steps[/bold]")
        for i, s in enumerate(steps, 1):
            body_lines.append(f"  {i}. {s}")
        body_lines.append("")
    if files:
        body_lines.append("[bold]Files[/bold]")
        for f in files:
            body_lines.append(f"  · {f}")
        body_lines.append("")
    if needs_swarm and swarm_agents:
        body_lines.append(f"[bold]Swarm[/bold]: {', '.join(swarm_agents)}")
        body_lines.append("")
    flags = []
    if will_verify:
        flags.append("verify")
    if will_commit:
        flags.append("commit")
    if flags:
        body_lines.append(f"[bold]After[/bold]: {' → '.join(flags)}")
        body_lines.append("")
    if risks:
        body_lines.append("[bold yellow]Risks[/bold yellow]")
        for r in risks:
            body_lines.append(f"  · {r}")

    console.print(Panel("\n".join(body_lines), title=f"[bold]{title}[/bold]", border_style="cyan"))

    answer = Prompt.ask(
        "[bold]proceed?[/bold]",
        choices=["y", "n", "edit"],
        default="y",
    )
    if answer == "y":
        return "approved"
    if answer == "n":
        reason = Prompt.ask("reason (optional)", default="")
        return f"rejected: {reason}" if reason else "rejected"
    # edit
    feedback = Prompt.ask("what to change")
    return f"revise: {feedback}"


def run_swarm(agents: list[str], prompt: str, *, collaborative: bool = False) -> str:
    """Spawn a swarm of named agents in parallel (or collab mode), return the synthesized output.

    Imports lazily so the chat loop's import graph stays light.
    """
    from kimi.agents.swarm import swarm as _swarm
    from kimi.catalog import SWARM_AGENTS, SYNTHESIZER

    selected = []
    unknown: list[str] = []
    for name in agents:
        if name == "synthesizer":
            continue
        if name not in SWARM_AGENTS:
            unknown.append(name)
            continue
        selected.append(SWARM_AGENTS[name])
    if unknown:
        return f"unknown agents: {unknown}. valid: {list(SWARM_AGENTS) + ['synthesizer']}"
    if not selected:
        return "refused: no valid agents specified"
    results = _swarm(selected, prompt, collaborative=collaborative, synthesizer=SYNTHESIZER)
    # The last result IS the synthesizer's combined ranked list.
    return results[-1]["out"] if results else "(no output)"


def vision_attach(source: str = "clipboard") -> str:
    """Grab an image from clipboard or interactive screenshot, return dense text.

    `source` is one of: 'clipboard', 'screenshot'.
    """
    from kimi.client import vision_describe
    from kimi.tools.vision import from_clipboard, screenshot_interactive

    path = None
    if source == "clipboard":
        path = from_clipboard()
        if not path:
            return "no image in clipboard"
    elif source == "screenshot":
        path = screenshot_interactive()
        if not path:
            return "screenshot failed or cancelled"
    else:
        return f"unknown source: {source}"
    return f"[image: {Path(path).name}]\n{vision_describe(path)}"
