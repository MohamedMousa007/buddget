"""Single OpenAI() factory + streaming chat with usage logging."""

from __future__ import annotations

import csv
import time
from datetime import datetime
from typing import Any, Iterable

from openai import OpenAI

from kimi import config
from kimi.secrets import get_api_key

_client: OpenAI | None = None


def client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=get_api_key(), base_url=config.BASE_URL)
    return _client


def _log_usage(model: str, prompt_tokens: int, completion_tokens: int) -> None:
    config.ensure_dirs()
    new = not config.USAGE_CSV.exists()
    with open(config.USAGE_CSV, "a", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["ts", "model", "prompt_tokens", "completion_tokens", "cost_usd"])
        cost = (
            prompt_tokens * config.PRICE_INPUT_PER_M / 1_000_000
            + completion_tokens * config.PRICE_OUTPUT_PER_M / 1_000_000
        )
        w.writerow(
            [datetime.now().isoformat(timespec="seconds"), model, prompt_tokens, completion_tokens, f"{cost:.6f}"]
        )


def chat_completion(
    messages: list[dict[str, Any]],
    *,
    model: str | None = None,
    tools: list[dict[str, Any]] | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    cache_key: str | None = None,
    stream: bool = True,
) -> dict[str, Any]:
    """Run one chat completion. Returns the assistant message dict (with optional tool_calls).

    When `stream=True`, yields content tokens to stdout via the caller's render hook —
    here we just collect; the CLI layer handles live rendering.
    """
    used_model = model or config.MODEL
    kwargs: dict[str, Any] = {
        "model": used_model,
        "messages": messages,
        "temperature": temperature if temperature is not None else config.TEMPERATURE,
        "max_tokens": max_tokens if max_tokens is not None else config.MAX_TOKENS,
    }
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"
    if cache_key:
        # Moonshot follows OpenAI prompt-prefix caching keying.
        kwargs["extra_body"] = {"prompt_cache_key": cache_key}

    # Retry loop: 3 tries with exponential backoff.
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            if stream:
                return _stream(kwargs, used_model)
            resp = client().chat.completions.create(**kwargs, stream=False)
            usage = resp.usage
            _log_usage(used_model, usage.prompt_tokens, usage.completion_tokens)
            msg = resp.choices[0].message
            # k2.6 is a thinking model — reasoning_content must be preserved
            # on assistant messages and round-tripped on the next request, or
            # the API rejects subsequent calls with "reasoning_content missing".
            reasoning = getattr(msg, "reasoning_content", None) or getattr(msg, "reasoning", None)
            out: dict[str, Any] = {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [tc.model_dump() for tc in (msg.tool_calls or [])],
                "usage": {"in": usage.prompt_tokens, "out": usage.completion_tokens},
            }
            if reasoning:
                out["reasoning_content"] = reasoning
            return out
        except Exception as e:  # noqa: BLE001 — surface raw errors after retries
            last_err = e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Kimi call failed after 3 attempts: {last_err}")


def _stream(kwargs: dict[str, Any], model: str) -> dict[str, Any]:
    """Stream tokens; return the same shape as the non-stream path."""
    from rich.console import Console

    console = Console()
    content_parts: list[str] = []
    reasoning_parts: list[str] = []
    # tool calls are aggregated by index → name/arguments accumulate
    tool_calls: dict[int, dict[str, Any]] = {}
    prompt_tokens = 0
    completion_tokens = 0

    resp = client().chat.completions.create(**kwargs, stream=True, stream_options={"include_usage": True})
    for chunk in resp:
        if chunk.usage:
            prompt_tokens = chunk.usage.prompt_tokens
            completion_tokens = chunk.usage.completion_tokens
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        # k2.6 emits reasoning_content first; we accumulate but don't print it.
        rc = getattr(delta, "reasoning_content", None) or getattr(delta, "reasoning", None)
        if rc:
            reasoning_parts.append(rc)
        if delta.content:
            content_parts.append(delta.content)
            console.print(delta.content, end="", style="white")
        if delta.tool_calls:
            for tc in delta.tool_calls:
                idx = tc.index
                slot = tool_calls.setdefault(
                    idx, {"id": "", "type": "function", "function": {"name": "", "arguments": ""}}
                )
                if tc.id:
                    slot["id"] = tc.id
                if tc.function and tc.function.name:
                    slot["function"]["name"] = tc.function.name
                if tc.function and tc.function.arguments:
                    slot["function"]["arguments"] += tc.function.arguments

    if content_parts:
        console.print()  # newline after streamed text

    _log_usage(model, prompt_tokens, completion_tokens)
    out: dict[str, Any] = {
        "role": "assistant",
        "content": "".join(content_parts),
        "tool_calls": [tool_calls[k] for k in sorted(tool_calls)],
        "usage": {"in": prompt_tokens, "out": completion_tokens},
    }
    if reasoning_parts:
        out["reasoning_content"] = "".join(reasoning_parts)
    return out


def vision_describe(image_path: str, hint: str = "") -> str:
    """Send a single VL turn that returns dense factual prose about the image.

    The text is then folded into the main K2.6 conversation as a regular user
    message — keeps the heavy multimodal model out of the long-running session.
    """
    import base64

    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    mime = "image/png" if image_path.lower().endswith(".png") else "image/jpeg"
    user_text = (
        "Describe this image in dense, factual prose. Capture every UI element, "
        "label, number, layout, and visible state. Be exhaustive but terse. "
        + (f"Hint: {hint}" if hint else "")
    )
    resp = client().chat.completions.create(
        model=config.VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_text},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                ],
            }
        ],
        max_tokens=800,
    )
    if resp.usage:
        _log_usage(config.VISION_MODEL, resp.usage.prompt_tokens, resp.usage.completion_tokens)
    return resp.choices[0].message.content or ""


def messages_iter_safe(messages: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop client-only keys (e.g. our `usage` annotation) before sending.

    Preserves `reasoning_content` because k2.6 requires it round-tripped on
    every assistant message that has tool_calls.
    """
    allowed = {"role", "content", "tool_calls", "tool_call_id", "name", "reasoning_content"}
    safe: list[dict[str, Any]] = []
    for m in messages:
        clean = {k: v for k, v in m.items() if k in allowed}
        if "tool_calls" in clean and not clean["tool_calls"]:
            del clean["tool_calls"]
        safe.append(clean)
    return safe
