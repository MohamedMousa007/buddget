"""Modal that renders the agent's `propose_plan` payload and collects y/n/edit."""

from __future__ import annotations

from typing import Any

from textual.app import ComposeResult
from textual.containers import Vertical, Horizontal
from textual.screen import ModalScreen
from textual.widgets import Button, Input, Static


class PlanModal(ModalScreen[str]):
    """Returns 'approved' | 'rejected[: reason]' | 'revise: feedback'."""

    def __init__(self, plan: dict[str, Any]) -> None:
        super().__init__()
        self.plan = plan
        self._editing = False

    def compose(self) -> ComposeResult:
        title = self.plan.get("title", "Plan")
        summary = self.plan.get("summary", "")
        steps = self.plan.get("steps", []) or []
        files = self.plan.get("files_to_touch", []) or []
        risks = self.plan.get("risks", []) or []
        agents = self.plan.get("swarm_agents", []) or []
        will_verify = self.plan.get("will_verify", False)
        will_commit = self.plan.get("will_commit", False)

        body_parts: list[str] = [f"[b]{title}[/b]\n"]
        if summary:
            body_parts.append(summary + "\n")
        if steps:
            body_parts.append("\n[b]Steps[/b]")
            for i, s in enumerate(steps, 1):
                body_parts.append(f"  {i}. {s}")
        if files:
            body_parts.append("\n[b]Files[/b]")
            for f in files:
                body_parts.append(f"  · {f}")
        if agents:
            body_parts.append(f"\n[b]Swarm[/b]: {', '.join(agents)}")
        flags = []
        if will_verify:
            flags.append("verify")
        if will_commit:
            flags.append("commit")
        if flags:
            body_parts.append(f"\n[b]After[/b]: {' → '.join(flags)}")
        if risks:
            body_parts.append("\n[b yellow]Risks[/b yellow]")
            for r in risks:
                body_parts.append(f"  · {r}")

        with Vertical(id="plan-panel"):
            yield Static("\n".join(body_parts), markup=True)
            yield Input(placeholder="Optional: feedback for revise / reject…", id="plan-feedback")
            with Horizontal(id="plan-buttons"):
                yield Button("Reject", id="plan-reject", variant="error")
                yield Button("Revise", id="plan-revise", variant="warning")
                yield Button("Approve", id="plan-approve", variant="success")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        feedback = self.query_one("#plan-feedback", Input).value.strip()
        if event.button.id == "plan-approve":
            self.dismiss("approved")
        elif event.button.id == "plan-reject":
            self.dismiss(f"rejected: {feedback}" if feedback else "rejected")
        elif event.button.id == "plan-revise":
            self.dismiss(f"revise: {feedback}" if feedback else "revise: (no feedback given)")
