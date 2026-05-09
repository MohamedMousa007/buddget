"""Git tools — status, diff, add, commit, push (with policy)."""

from __future__ import annotations

from git import Repo

from kimi import config
from kimi.policy import can_push, scan_for_secrets


def _repo() -> Repo:
    return Repo(config.PROJECT_ROOT, search_parent_directories=True)


def status() -> str:
    r = _repo()
    out = [f"branch: {r.active_branch.name}", f"head: {r.head.commit.hexsha[:8]} {r.head.commit.summary}"]
    diff = r.git.status("--short")
    out.append(diff or "(clean tree)")
    return "\n".join(out)


def diff(staged: bool = False, path: str | None = None) -> str:
    r = _repo()
    args = ["--no-color"]
    if staged:
        args.append("--cached")
    if path:
        args.append("--")
        args.append(path)
    return r.git.diff(*args)


def add(path: str = ".") -> str:
    r = _repo()
    r.git.add(path)
    return f"staged: {path}"


def commit(message: str) -> str:
    r = _repo()
    # Secret scan on the staged diff before committing.
    staged = r.git.diff("--cached", "--no-color")
    hits = scan_for_secrets(staged)
    if hits:
        return f"refused: staged diff contains likely secrets: {hits}"
    if not staged.strip():
        return "refused: nothing staged"
    full_msg = message + "\n\nCo-Authored-By: Kimi K2.6 <noreply@moonshot.ai>"
    r.git.commit("-m", full_msg)
    return f"committed: {r.head.commit.hexsha[:8]} {r.head.commit.summary}"


def push(target_branch: str | None = None, allow_main: bool = False) -> str:
    r = _repo()
    target = target_branch or config.DEV_BRANCH
    ok, why = can_push(target, allow_main)
    if not ok:
        return why
    current = r.active_branch.name
    # Push current HEAD to <target>.
    r.git.push("origin", f"{current}:{target}")
    return f"pushed {current} → origin/{target}"


def current_branch() -> str:
    return _repo().active_branch.name
