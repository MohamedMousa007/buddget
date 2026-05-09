"""Agent dataclass — name, system prompt, allowed tool set, model override."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from kimi import config


@dataclass(frozen=True)
class Agent:
    name: str
    role: str
    system_prompt: str
    write: bool = False  # whether this agent gets write/git/verify tools
    model: str | None = None  # override KIMI_MODEL

    @classmethod
    def from_prompt_file(cls, name: str, role: str, prompt_path: str | Path, *, write: bool = False) -> "Agent":
        p = Path(prompt_path)
        if not p.is_absolute():
            p = Path(__file__).parent.parent / "prompts" / p
        text = p.read_text() if p.exists() else f"You are {name}, a {role}."
        return cls(name=name, role=role, system_prompt=text, write=write)
