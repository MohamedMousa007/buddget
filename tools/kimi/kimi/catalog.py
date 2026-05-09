"""Named Buddget swarm agents."""

from __future__ import annotations

from kimi.agents.base import Agent

# All read-only swarm agents. Engineer mode gets write privileges separately.
SWARM_AGENTS: dict[str, Agent] = {
    "onboarding-coherence": Agent.from_prompt_file(
        "onboarding-coherence", "onboarding flow auditor", "onboarding-coherence.md"
    ),
    "budget-sync-checker": Agent.from_prompt_file(
        "budget-sync-checker", "cross-surface number-consistency auditor", "budget-sync-checker.md"
    ),
    "rls-auditor": Agent.from_prompt_file("rls-auditor", "Supabase RLS auditor", "rls-auditor.md"),
    "schema-drift": Agent.from_prompt_file("schema-drift", "schema-vs-types drift auditor", "schema-drift.md"),
    "i18n-coverage": Agent.from_prompt_file("i18n-coverage", "i18n key parity auditor", "i18n-coverage.md"),
    "dead-code": Agent.from_prompt_file("dead-code", "unused code finder", "dead-code.md"),
    "tutorial-stability": Agent.from_prompt_file("tutorial-stability", "tutorial regression scanner", "tutorial-stability.md"),
    "prompt-tuner": Agent.from_prompt_file("prompt-tuner", "AI prompt regression catcher", "prompt-tuner.md"),
    "a11y": Agent.from_prompt_file("a11y", "accessibility auditor", "a11y.md"),
    "bundle-size": Agent.from_prompt_file("bundle-size", "bundle size auditor", "bundle-size.md"),
    "copy-tone": Agent.from_prompt_file("copy-tone", "copywriting reviewer", "copy-tone.md"),
    "test-gap": Agent.from_prompt_file("test-gap", "missing-test detector", "test-gap.md"),
    "secret-scan": Agent.from_prompt_file("secret-scan", "secret detector", "secret-scan.md"),
}

SYNTHESIZER: Agent = Agent.from_prompt_file("synthesizer", "ranked-action-list synthesizer", "synthesizer.md")


def get(names: list[str]) -> list[Agent]:
    out: list[Agent] = []
    for n in names:
        if n == "synthesizer":
            continue  # handled separately by the swarm caller
        if n not in SWARM_AGENTS:
            raise SystemExit(f"unknown agent: {n} (valid: {', '.join(SWARM_AGENTS)} synthesizer)")
        out.append(SWARM_AGENTS[n])
    return out


def list_names() -> list[str]:
    return list(SWARM_AGENTS) + ["synthesizer"]
