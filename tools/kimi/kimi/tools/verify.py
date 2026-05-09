"""CI parity runner: lint + tsc + vitest + next build with dummy Supabase env."""

from __future__ import annotations

import os
import subprocess

from kimi import config

DUMMY_ENV = {
    "NEXT_PUBLIC_SUPABASE_URL": "https://dummy.supabase.co",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "dummy",
}


def _run(cmd: list[str], timeout: int) -> tuple[int, str]:
    env = {**os.environ, **DUMMY_ENV}
    try:
        r = subprocess.run(
            cmd,
            cwd=config.PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
        )
    except subprocess.TimeoutExpired:
        return 124, f"<timed out after {timeout}s>"
    out = (r.stdout or "")[-3000:] + "\n" + (r.stderr or "")[-3000:]
    return r.returncode, out.strip()


def run_lint() -> tuple[int, str]:
    return _run(["npm", "run", "lint"], 240)


def run_tsc() -> tuple[int, str]:
    return _run(["npx", "tsc", "--noEmit"], 240)


def run_tests() -> tuple[int, str]:
    return _run(["npm", "test"], 300)


def run_build() -> tuple[int, str]:
    return _run(["npm", "run", "build"], 420)


def run_all() -> dict[str, tuple[int, str]]:
    """Run the four CI checks in order, short-circuiting on failure.

    Returns dict keyed by step name → (exit_code, captured output tail).
    """
    results: dict[str, tuple[int, str]] = {}
    for name, fn in [("lint", run_lint), ("tsc", run_tsc), ("test", run_tests), ("build", run_build)]:
        code, out = fn()
        results[name] = (code, out)
        if code != 0:
            break
    return results


def all_passed(results: dict[str, tuple[int, str]]) -> bool:
    return all(code == 0 for code, _ in results.values()) and len(results) == 4
