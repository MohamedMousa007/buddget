"""Core agent loop — sends a conversation, dispatches any tool calls, repeats.

This is the heart of every mode (chat, engineer, swarm). The loop:
  1. Send messages + tool schemas to Kimi.
  2. If the model returns tool_calls, dispatch each, append results, loop.
  3. If the model returns plain text, return.

Stops at `max_steps` to avoid runaway loops. Errors during tool dispatch are
surfaced back to the model as tool results so it can self-correct (this is
the "autonomous error recovery" you asked for).
"""

from __future__ import annotations

import json
from typing import Any, Callable

from rich.console import Console

from kimi import client as _client
from kimi import memory
from kimi.agents.base import Agent
from kimi.tools import registry

console = Console()


def build_messages(agent: Agent, user_messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Inject the stable system prefix (memory + rules) ahead of the agent's own system prompt."""
    sys = memory.system_prefix() + "\n\n" + agent.system_prompt
    return [{"role": "system", "content": sys}, *user_messages]


def step(agent: Agent, messages: list[dict[str, Any]], *, stream: bool = True) -> dict[str, Any]:
    """One model turn. Returns the assistant message."""
    msg = _client.chat_completion(
        _client.messages_iter_safe(messages),
        model=agent.model,
        tools=registry.schemas(write=agent.write),
        cache_key=memory.cache_key(),
        stream=stream,
    )
    return msg


def run(
    agent: Agent,
    user_messages: list[dict[str, Any]],
    *,
    max_steps: int = 24,
    on_tool_call: Callable[[str, str, str], None] | None = None,
    stream: bool = True,
) -> list[dict[str, Any]]:
    """Run an agent to completion. Returns the full message list including tool results."""
    messages = build_messages(agent, list(user_messages))
    for step_n in range(max_steps):
        assistant = step(agent, messages, stream=stream)
        messages.append(assistant)

        tool_calls = assistant.get("tool_calls") or []
        if not tool_calls:
            return messages

        # Dispatch each tool call, append the tool message back to the conversation.
        for tc in tool_calls:
            name = tc["function"]["name"]
            raw_args = tc["function"]["arguments"]
            from kimi.runtime import TOOL_HOOK

            short_args = raw_args[:80] + ("…" if len(raw_args) > 80 else "")
            if TOOL_HOOK is not None:
                TOOL_HOOK(name, short_args)
            else:
                console.print(f"  [dim]→ {name}({short_args})[/dim]")
            output = registry.call(name, raw_args)
            if on_tool_call:
                on_tool_call(name, raw_args, output)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "name": name,
                    "content": output[:8000],  # cap to keep token use predictable
                }
            )
    console.print(f"[yellow]agent stopped at max_steps={max_steps}[/yellow]")
    return messages
