"""Textual TUI for Kimi — minimalistic, matching Claude Code's feel.

Layout:
  - Top: model + branch + mode dropdowns; Pull / Sync / Status buttons.
  - Middle: streaming output / progress (RichLog).
  - Status row: model · tokens · cost · branch · ahead/behind.
  - Bottom: input + attach + send.
"""

from __future__ import annotations

import threading
import time
from pathlib import Path
from typing import Any

from textual import work
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.widgets import Button, Header, Input, RichLog, Select, Static

from kimi import config, memory, runtime
from kimi.agents.base import Agent
from kimi.agents.chat import ROUTER_SYSTEM_DIRECT, ROUTER_SYSTEM_PLAN
from kimi.agents.loop import run as run_loop
from kimi.tools import git as git_tools
from kimi.tui.plan_modal import PlanModal
from kimi.ui.statusbar import KNOWN_MODELS, SessionState, update_branch_state

# A third routing mode that biases toward swarms for analysis tasks.
ROUTER_SYSTEM_SWARM = """You are Kimi, a senior engineer in the user's terminal on the Buddget app.
You are the SINGLE entrypoint. You decide the workflow.

# Routing rules (SWARM mode)

For any analysis, audit, or review request, your DEFAULT path is:
1. Call `propose_plan` with `needs_swarm: true` and the relevant 2-5 agents.
2. After approval, call `run_swarm` with that agent list.
3. Summarise the synthesizer output for the user.

For pure code edits, follow PLAN mode rules: propose first, execute on approval.

# Constraints
- ripgrep > read_file. No re-reads.
- Never push.
- Refuse to commit if you see secrets in the diff.
- Be terse.
"""

MODE_PROMPTS: dict[str, str] = {
    "plan": ROUTER_SYSTEM_PLAN,
    "execute": ROUTER_SYSTEM_DIRECT,
    "swarm": ROUTER_SYSTEM_SWARM,
}

BRANCH_OPTIONS = [("dev", "dev"), ("main", "main"), ("both", "both"), ("current", "current")]
MODE_OPTIONS = [("execute", "execute"), ("plan", "plan"), ("swarm", "swarm")]


class KimiTUI(App):
    CSS_PATH = "styles.tcss"
    TITLE = "kimi"
    SUB_TITLE = ""

    BINDINGS = [
        Binding("ctrl+c", "quit", "Quit", show=False),
        Binding("ctrl+l", "clear_output", "Clear", show=True),
        Binding("ctrl+r", "refresh_status", "Refresh", show=True),
    ]

    def __init__(self) -> None:
        super().__init__()
        config.ensure_dirs()
        memory.bootstrap()
        self.state = SessionState(model=config.MODEL, mode="plan", push_targets=("dev",))
        self.history: list[dict[str, str]] = []
        self.session_path = config.SESSIONS_DIR / f"chat-tui-{int(time.time())}.jsonl"
        self._stream_buf: list[str] = []
        self._busy = False

    # ─── compose ───────────────────────────────────────────────────

    def compose(self) -> ComposeResult:
        yield Header(show_clock=False)

        with Vertical(id="top-bar"):
            with Horizontal(id="controls"):
                yield Select(
                    [(m, m) for m in KNOWN_MODELS],
                    value=self.state.model if self.state.model in KNOWN_MODELS else KNOWN_MODELS[0],
                    id="model-select",
                    allow_blank=False,
                )
                yield Select(BRANCH_OPTIONS, value="dev", id="branch-select", allow_blank=False)
                yield Select(MODE_OPTIONS, value="plan", id="mode-select", allow_blank=False)
                yield Button("Pull", id="pull-btn")
                yield Button("Sync", id="sync-btn")
                yield Button("Status", id="status-btn")

        yield RichLog(id="output", highlight=True, markup=True, wrap=True)

        with Horizontal(id="status-bar"):
            yield Static(self._status_line(), id="status-text", markup=True)

        with Horizontal(id="input-bar"):
            yield Input(placeholder="Tell me what you want…", id="user-input")
            yield Button("📎", id="attach-btn", classes="icon")
            yield Button("Send", id="send-btn", variant="primary")

    # ─── lifecycle ─────────────────────────────────────────────────

    def on_mount(self) -> None:
        # Wire runtime hooks so the agent loop pushes events into this UI.
        runtime.set_plan_hook(self._handle_plan)
        runtime.set_tool_hook(self._handle_tool)
        runtime.set_stream_hook(self._handle_stream)

        self.query_one("#user-input", Input).focus()
        self._fetch_branch_state()
        self._refresh_status_widget()
        self._log("[dim]Welcome. Pick a model/branch/mode and tell me what to do.[/dim]")

    def on_unmount(self) -> None:
        runtime.set_plan_hook(None)
        runtime.set_tool_hook(None)
        runtime.set_stream_hook(None)

    # ─── event handlers ───────────────────────────────────────────

    def on_select_changed(self, event: Select.Changed) -> None:
        if event.select.id == "model-select":
            self.state.model = str(event.value)
            self._log(f"[dim]model → {self.state.model}[/dim]")
        elif event.select.id == "mode-select":
            self.state.mode = str(event.value)
            self._log(f"[dim]mode → {self.state.mode}[/dim]")
        elif event.select.id == "branch-select":
            self._handle_branch_change(str(event.value))
        self._refresh_status_widget()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        if event.input.id == "user-input":
            self._send()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "send-btn":
            self._send()
        elif event.button.id == "attach-btn":
            self._attach_image()
        elif event.button.id == "pull-btn":
            self._do_pull()
        elif event.button.id == "sync-btn":
            self._do_sync()
        elif event.button.id == "status-btn":
            self._show_status()

    # ─── actions ──────────────────────────────────────────────────

    def action_clear_output(self) -> None:
        self.query_one("#output", RichLog).clear()
        self.history.clear()
        self._log("[dim]history cleared.[/dim]")

    def action_refresh_status(self) -> None:
        self._fetch_branch_state()
        self._refresh_status_widget()
        self._log("[dim]status refreshed.[/dim]")

    # ─── send + agent worker ──────────────────────────────────────

    def _send(self) -> None:
        if self._busy:
            self._log("[yellow]busy — wait for the current turn to finish.[/yellow]")
            return
        inp = self.query_one("#user-input", Input)
        text = inp.value.strip()
        if not text:
            return
        inp.value = ""
        self._log(f"[bold cyan]you:[/bold cyan] {text}")
        self.history.append({"role": "user", "content": text})
        self._busy = True
        self._refresh_status_widget()
        self._run_agent_worker(self.history.copy())

    @work(thread=True, exclusive=True)
    def _run_agent_worker(self, history: list[dict[str, str]]) -> None:
        agent = Agent(
            name="kimi",
            role="senior engineer (router)",
            system_prompt=MODE_PROMPTS[self.state.mode],
            write=True,
            model=self.state.model,
        )
        try:
            self._stream_buf.clear()
            self._post_log("[bold magenta]kimi:[/bold magenta] ")
            final = run_loop(agent, history)
            # Persist session
            with open(self.session_path, "a") as f:
                import json

                for m in final[len(history):]:
                    f.write(json.dumps(m, default=str) + "\n")

            last_assistant = next(
                (m for m in reversed(final) if m.get("role") == "assistant" and m.get("content")), None
            )
            if last_assistant:
                self.history.append({"role": "assistant", "content": last_assistant["content"]})
                usage = last_assistant.get("usage") or {}
                self.state.session_in += int(usage.get("in", 0))
                self.state.session_out += int(usage.get("out", 0))
                self.state.session_cost = (
                    self.state.session_in * config.PRICE_INPUT_PER_M / 1_000_000
                    + self.state.session_out * config.PRICE_OUTPUT_PER_M / 1_000_000
                )
        except Exception as e:  # noqa: BLE001
            self._post_log(f"\n[red]error: {e}[/red]")
        finally:
            self._busy = False
            self.call_from_thread(self._refresh_status_widget)
            self._post_log("\n")

    # ─── runtime hooks (called from worker thread) ────────────────

    def _handle_plan(self, plan: dict[str, Any]) -> str:
        """Show modal in main thread, block worker until user answers."""
        ev = threading.Event()
        result: dict[str, str] = {"value": "rejected"}

        def push() -> None:
            self.push_screen(PlanModal(plan), lambda res: (result.__setitem__("value", res or "rejected"), ev.set()))

        self.call_from_thread(push)
        ev.wait()
        self._post_log(f"[dim]plan decision: {result['value'][:80]}[/dim]")
        return result["value"]

    def _handle_tool(self, name: str, args_repr: str) -> None:
        self._post_log(f"  [dim]→ {name}({args_repr})[/dim]")

    def _handle_stream(self, token: str) -> None:
        self._post_log(token, end="")

    # ─── action handlers (run on UI thread) ───────────────────────

    def _handle_branch_change(self, branch: str) -> None:
        if branch == "current":
            cur = git_tools.current_branch()
            self.state.push_targets = (cur,)
            self._log(f"[dim]push target → {cur} (no checkout)[/dim]")
            return
        if branch == "both":
            self.state.push_targets = (config.DEV_BRANCH, config.MAIN_BRANCH)
            self._log("[dim]push targets → dev + main[/dim]")
            self._fetch_branch_state()
            return
        # dev or main: try checkout, fall back to push-target-only.
        if git_tools.is_worktree():
            self.state.push_targets = (branch,)
            self._log(f"[yellow]worktree pinned to {git_tools.current_branch()}; only updating push target → {branch}[/yellow]")
        else:
            result = git_tools.checkout(branch)
            self._log(f"[dim]{result}[/dim]")
            self.state.push_targets = (branch,)
        self._fetch_branch_state()

    @work(thread=True, exclusive=False)
    def _do_pull(self) -> None:
        self._post_log("[dim]pulling dev + main…[/dim]")
        for b in (config.DEV_BRANCH, config.MAIN_BRANCH):
            self._post_log(f"  [dim]· {git_tools.pull(b)}[/dim]")
        self.call_from_thread(self._fetch_branch_state)
        self.call_from_thread(self._refresh_status_widget)

    @work(thread=True, exclusive=False)
    def _do_sync(self) -> None:
        self._post_log("[dim]sync — pulling…[/dim]")
        for b in (config.DEV_BRANCH, config.MAIN_BRANCH):
            self._post_log(f"  [dim]· {git_tools.pull(b)}[/dim]")
        targets = list(self.state.push_targets)
        if config.MAIN_BRANCH in targets and not config.ALLOW_MAIN:
            self._post_log(f"[yellow]skipping push to {config.MAIN_BRANCH} (set KIMI_ALLOW_MAIN=1)[/yellow]")
            targets = [t for t in targets if t != config.MAIN_BRANCH]
        if targets:
            self._post_log(f"[dim]pushing → {', '.join(targets)}[/dim]")
            self._post_log(f"  [dim]{git_tools.push_many(targets, allow_main=config.ALLOW_MAIN)}[/dim]")
        self.call_from_thread(self._fetch_branch_state)
        self.call_from_thread(self._refresh_status_widget)

    @work(thread=True, exclusive=False)
    def _show_status(self) -> None:
        self.call_from_thread(self._fetch_branch_state)
        for branch in (config.DEV_BRANCH, config.MAIN_BRANCH):
            ahead, behind = git_tools.ahead_behind(branch)
            summary = git_tools.commits_behind_summary(branch) if behind > 0 else "(up to date)"
            self._post_log(f"[bold]{branch}[/bold]  ↑{ahead}  ↓{behind}\n{summary}\n")
        self.call_from_thread(self._refresh_status_widget)

    def _attach_image(self) -> None:
        self._do_attach()

    @work(thread=True, exclusive=False)
    def _do_attach(self) -> None:
        from kimi.client import vision_describe
        from kimi.tools.vision import from_clipboard

        path = from_clipboard()
        if not path:
            self._post_log("[red]no image in clipboard[/red]")
            return
        self._post_log(f"[dim]→ describing image via {config.VISION_MODEL}…[/dim]")
        try:
            desc = vision_describe(path)
            self.history.append({"role": "user", "content": f"[clipboard image]\n{desc}"})
            self._post_log(f"[dim]image attached. say what to do with it.[/dim]")
        except Exception as e:  # noqa: BLE001
            self._post_log(f"[red]vision failed: {e}[/red]")

    # ─── helpers ──────────────────────────────────────────────────

    def _fetch_branch_state(self) -> None:
        update_branch_state(self.state, fetch=True)

    def _refresh_status_widget(self) -> None:
        try:
            self.query_one("#status-text", Static).update(self._status_line())
        except Exception:  # noqa: BLE001
            pass

    def _status_line(self) -> str:
        push = "+".join(self.state.push_targets) or "—"
        dev_chip = self._chip("dev", self.state.dev_ahead, self.state.dev_behind)
        main_chip = self._chip("main", self.state.main_ahead, self.state.main_behind)
        cost = f"${self.state.session_cost:.4f}"
        toks = f"{self.state.session_in:,}↑ {self.state.session_out:,}↓"
        busy = "[yellow]●[/yellow] working" if self._busy else "[green]●[/green] idle"
        return (
            f"{busy}  [b]{self.state.model}[/b]  mode [cyan]{self.state.mode}[/cyan]  "
            f"push [magenta]{push}[/magenta]  branch {self.state.branch}  "
            f"{dev_chip}  {main_chip}  [dim]{toks} · {cost}[/dim]"
        )

    @staticmethod
    def _chip(name: str, ahead: int, behind: int) -> str:
        if ahead == 0 and behind == 0:
            return f"[green]{name}✓[/green]"
        parts = []
        if ahead:
            parts.append(f"↑{ahead}")
        if behind:
            parts.append(f"↓{behind}")
        color = "yellow" if behind else "blue"
        return f"[{color}]{name} {' '.join(parts)}[/{color}]"

    # ─── thread-safe RichLog writers ──────────────────────────────

    def _log(self, msg: str) -> None:
        self.query_one("#output", RichLog).write(msg)

    def _post_log(self, msg: str, *, end: str = "\n") -> None:
        """Schedule a write from worker threads."""
        text = msg + end
        try:
            self.call_from_thread(self.query_one("#output", RichLog).write, text)
        except Exception:  # noqa: BLE001
            pass


def run_tui() -> None:
    KimiTUI().run()
