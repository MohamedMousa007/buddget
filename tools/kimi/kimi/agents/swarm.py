"""Swarm orchestrator — parallel multi-agent runs with optional collaboration."""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor

from rich.console import Console
from rich.panel import Panel

from kimi import config
from kimi.agents.base import Agent
from kimi.agents.loop import run as run_loop


def _run_one(agent: Agent, prompt: str, prior: list[dict[str, str]] | None = None) -> dict[str, str]:
    messages: list[dict[str, str]] = []
    if prior:
        bundle = "\n\n".join(f"### {m['from']}\n{m['out']}" for m in prior)
        messages.append({"role": "user", "content": f"Prior agents' findings:\n{bundle}"})
    messages.append({"role": "user", "content": prompt})
    history = run_loop(agent, messages, max_steps=18, stream=False)
    last = next((m for m in reversed(history) if m.get("role") == "assistant" and m.get("content")), {})
    return {"from": agent.name, "role": agent.role, "out": last.get("content", "")}


def swarm(
    agents: list[Agent],
    prompt: str,
    *,
    collaborative: bool = False,
    synthesizer: Agent | None = None,
) -> list[dict[str, str]]:
    """Run all agents and (optionally) hand them off to a synthesizer.

    parallel mode (default): all agents run concurrently, no shared context.
    collaborative=True: agents run in sequence, each one sees prior outputs.
    """
    console = Console()
    config.ensure_dirs()

    console.print(Panel.fit(f"[bold]swarm[/bold] · {len(agents)} agents · {'collaborative' if collaborative else 'parallel'}", border_style="magenta"))

    results: list[dict[str, str]] = []
    if collaborative:
        for a in agents:
            console.print(f"[dim]→ {a.name}[/dim]")
            results.append(_run_one(a, prompt, prior=results))
    else:
        with ThreadPoolExecutor(max_workers=min(8, len(agents))) as ex:
            futures = {ex.submit(_run_one, a, prompt): a for a in agents}
            for fut in futures:
                results.append(fut.result())

    if synthesizer is not None:
        console.print(f"[dim]→ {synthesizer.name} (synthesizing)[/dim]")
        synth_in = "\n\n".join(f"### {r['from']} ({r['role']})\n{r['out']}" for r in results)
        synth = _run_one(synthesizer, f"Synthesize these agent outputs into a single ranked action list:\n\n{synth_in}")
        results.append(synth)

    # Persist the swarm result.
    out_path = config.SESSIONS_DIR / f"swarm-{int(time.time())}.md"
    with open(out_path, "w") as f:
        for r in results:
            f.write(f"## {r['from']} — {r['role']}\n\n{r['out']}\n\n---\n\n")
    console.print(f"[dim]saved → {out_path.relative_to(config.PROJECT_ROOT)}[/dim]")

    # Print to terminal.
    for r in results:
        console.print(Panel(r["out"], title=f"{r['from']} · {r['role']}", border_style="magenta"))

    return results
