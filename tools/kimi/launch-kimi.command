#!/bin/bash
# Double-click to launch the Kimi TUI.
#
# Resolves the venv next to this file, finds the project root (walking up to
# `package.json`), and — if that root is a git worktree — hops to the main
# checkout so the branch dropdown can actually `git checkout` for you.
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VENV="$SCRIPT_DIR/.venv"

if [ ! -f "$VENV/bin/activate" ]; then
  echo "Kimi venv not found at: $VENV"
  echo
  echo "Install once with:"
  echo "  cd \"$SCRIPT_DIR\""
  echo "  python3 -m venv .venv"
  echo "  source .venv/bin/activate"
  echo "  pip install -e ."
  echo
  read -r -p "Press Enter to close…" _
  exit 1
fi

# shellcheck disable=SC1091
source "$VENV/bin/activate"

# Walk up to the project root (package.json marker).
PROJECT_ROOT="$SCRIPT_DIR"
while [ "$PROJECT_ROOT" != "/" ]; do
  [ -f "$PROJECT_ROOT/package.json" ] && break
  PROJECT_ROOT="$(dirname "$PROJECT_ROOT")"
done

# If we landed inside a git worktree (`.git` is a file, not a dir), hop to
# the main checkout so `git checkout dev/main` from the TUI actually works.
if [ -f "$PROJECT_ROOT/.git" ]; then
  GITDIR_LINE=$(cat "$PROJECT_ROOT/.git")
  GITDIR="${GITDIR_LINE#gitdir: }"
  # GITDIR is like /abs/main-repo/.git/worktrees/<name>; main repo is its 3-up parent.
  MAIN_REPO=$(dirname "$(dirname "$(dirname "$GITDIR")")")
  if [ -f "$MAIN_REPO/package.json" ] && [ -d "$MAIN_REPO/.git" ]; then
    PROJECT_ROOT="$MAIN_REPO"
  fi
fi

cd "$PROJECT_ROOT"
echo "kimi tui · project: $PROJECT_ROOT"
exec kimi tui
