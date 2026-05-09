"""Git tools — status, diff, add, commit, push, fetch, pull, ahead/behind."""

from __future__ import annotations

from git import GitCommandError, Repo

from kimi import config
from kimi.policy import can_push, scan_for_secrets


def _repo() -> Repo:
    return Repo(config.PROJECT_ROOT, search_parent_directories=True)


def fetch_all() -> str:
    r = _repo()
    r.git.fetch("--all", "--prune")
    return "fetched"


def ahead_behind(branch: str) -> tuple[int, int]:
    """Return (ahead, behind) for `branch` vs `origin/<branch>`. Fetches first."""
    r = _repo()
    try:
        out = r.git.rev_list("--left-right", "--count", f"origin/{branch}...{branch}")
    except GitCommandError:
        return (0, 0)
    parts = out.strip().split()
    if len(parts) != 2:
        return (0, 0)
    behind, ahead = int(parts[0]), int(parts[1])
    return ahead, behind


def commits_behind_summary(branch: str, limit: int = 10) -> str:
    """Short summary of commits in `origin/<branch>` not yet in local `<branch>`."""
    r = _repo()
    try:
        out = r.git.log(f"{branch}..origin/{branch}", "--oneline", f"-{limit}")
    except GitCommandError as e:
        return f"(no remote ref or branch missing: {e})"
    return out.strip() or "(none)"


def pull(branch: str | None = None, *, ff_only: bool = True) -> str:
    """Fast-forward pull. Uses current branch unless `branch` is given.

    For Buddget's two-branch flow: `pull dev` and `pull main` are the common
    operations. We pull each into its own ref via fetch + merge --ff-only,
    keeping the working tree clean.
    """
    r = _repo()
    target = branch or r.active_branch.name
    try:
        if branch and r.active_branch.name != branch:
            # Fast-forward the named branch's local ref to its remote without
            # checking it out (works for both dev and main from any worktree).
            r.git.fetch("origin", f"{target}:{target}")
            return f"fast-forwarded local `{target}` → origin/{target}"
        cmd = ["pull", "origin", target]
        if ff_only:
            cmd.append("--ff-only")
        r.git.execute(["git", *cmd])
        return f"pulled origin/{target} → {target}"
    except GitCommandError as e:
        return f"pull failed: {e.stderr or e}"


def is_worktree() -> bool:
    """True if the current working tree is a git worktree (not the main checkout)."""
    r = _repo()
    try:
        # Worktrees have `.git` as a file pointing to gitdir; main checkouts have a directory.
        from pathlib import Path

        gitpath = Path(r.working_dir) / ".git"
        return gitpath.is_file()
    except Exception:  # noqa: BLE001
        return False


def checkout(branch: str) -> str:
    """Checkout `branch`. Refuses on worktree (worktree is pinned to its branch)."""
    if is_worktree():
        return f"refused: this is a git worktree pinned to {current_branch()}; switch to the main checkout to change branches"
    r = _repo()
    try:
        r.git.checkout(branch)
        return f"checked out {branch}"
    except GitCommandError as e:
        return f"checkout failed: {e.stderr or e}"


def push_to(target: str, allow_main: bool = False) -> str:
    """Push current HEAD to a single remote branch with policy checks."""
    r = _repo()
    ok, why = can_push(target, allow_main)
    if not ok:
        return why
    current = r.active_branch.name
    try:
        r.git.push("origin", f"{current}:{target}")
        return f"pushed {current} → origin/{target}"
    except GitCommandError as e:
        return f"push failed: {e.stderr or e}"


def push_many(targets: list[str], allow_main: bool = False) -> str:
    """Push to multiple branches in order. First failure short-circuits."""
    out: list[str] = []
    for t in targets:
        result = push_to(t, allow_main=allow_main)
        out.append(result)
        if "failed" in result.lower() or "refused" in result.lower():
            break
    return "\n".join(out)


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
    return push_to(target_branch or config.DEV_BRANCH, allow_main=allow_main)


def current_branch() -> str:
    return _repo().active_branch.name
