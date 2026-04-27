# Buddget — Claude Rules

These rules apply to every Claude session in this repo. They are versioned in git so all accounts/worktrees stay in sync.

## Workflow
- **Request lifecycle:** classify tier → scope context → execute → verify → auto-push to `dev` and `main` → report. No plan-approval step.
- **Branch workflow (AUTO-MERGE):** every push to `dev` also merges into `main`. No PRs, no feature branches. Reverts to manual only on explicit ask.
- **Verify before push:** full CI parity locally — lint + tsc + test + build **with dummy Supabase env**. Building without env silently skips prerender paths CI hits.
- **gh CLI auth:** prefix with `GH_TOKEN=$(git credential fill ...)`; `gh auth login` fails the scope check.

## Code style
- Enterprise structure: clean module boundaries, single-responsibility files, parallel-team-friendly, readable cold.
- No defensive checks for impossible states. No backwards-compat shims for unreleased code. No comments that restate the code.

## Token economy (always on)
Minimize tokens in every response and tool call without sacrificing correctness or output quality.

- Skip preambles ("Let me…", "I'll now…") and recaps of the user's request.
- Default to silent execution between tool calls; one-sentence status only when genuinely useful.
- End-of-turn summary: ≤2 short sentences. No bullet lists unless content is actually a list.
- Don't re-read files already read this turn. Don't grep to "verify" something already shown.
- Parallelize independent tool calls in a single block.
- Prefer `Edit` over `Write`; read targeted line ranges, not whole files, when large.
- No emojis, no decorative headers on short answers.
- Cut *unnecessary* checks/words — never load-bearing ones. Correctness > brevity when they conflict.
