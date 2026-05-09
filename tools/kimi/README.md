# Kimi CLI

Cursor / Claude-Code-style coding agent for Buddget, powered by Kimi K2.6.

## Install

```bash
cd tools/kimi
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

That puts `kimi` on your `PATH` (inside the venv). To use it from anywhere:

```bash
# add a shim once
mkdir -p ~/.local/bin
ln -sf "$(pwd)/.venv/bin/kimi" ~/.local/bin/kimi
# ensure ~/.local/bin is in PATH (most shells already include it)
```

## First run

```bash
kimi doctor          # checks API key, ripgrep, git, model reachability
```

The API key is read from:
1. `.env.kimi` at project root (already in place)
2. macOS Keychain item `kimi-api-key`

## Cheat sheet

```bash
# chat (Cursor mode)
kimi chat "what does applyBudgetPlan do?"
kimi chat --image ~/Desktop/buddgy.png "what's wrong with this design?"
kimi chat --clip "review this screenshot"
kimi chat --screenshot "review this region"

# autonomous engineer (Claude Code mode)
kimi engineer "remove the lifetime savingsTotal from DashboardSummaryCards props"
# → investigates, edits, runs lint+tsc+test+build, retries on failure, commits to current branch

# swarm (parallel multi-agent analysis)
kimi swarm-list                                              # see all agents
kimi swarm onboarding-coherence copy-tone --prompt "Audit the onboarding flow for issues"
kimi swarm budget-sync-checker --prompt "Check homepage budget numbers" --collab

# pre-merge sweep on the current diff
kimi review

# push (dev-only by default)
kimi push                                # pushes HEAD to origin/dev
KIMI_ALLOW_MAIN=1 kimi push --to-main    # pushes to main with confirm prompt

# memory
kimi memory-show
kimi memory-remember "fact to add"

# cost
kimi cost
```

## Models (override in `.env.kimi`)

```
KIMI_MODEL=kimi-k2.6
KIMI_VISION_MODEL=moonshot-v1-32k-vision-preview
```

When Moonshot ships a newer text or vision model, just update those two env values.

## How it stays cheap

- Every "find" routes through `ripgrep`, returning file:line:match — not whole files.
- Stable system prompt + tool schemas + project memory are sent under one `prompt_cache_key` so Moonshot's prefix cache reuses them across turns.
- Tool outputs are capped at 8 KB. Long terminal output is truncated, not replayed.
- Streaming + Esc abort lets you bail early on a wrong direction.

## Autonomous error recovery

`kimi engineer` runs `verify` (lint + tsc + vitest + next build with dummy Supabase env) after every edit. If anything fails, the failing step's output is fed back as the next user message, and the agent re-enters its tool loop to fix it. Loops up to 4 attempts before giving up.

## Push policy

`policy.py` enforces:
- `kimi push` only ever targets `dev`.
- `kimi push --to-main` requires `KIMI_ALLOW_MAIN=1` in your shell **and** an interactive `y/n` prompt.
- Secret-regex scan runs over every staged diff before commit.
- File-edit guards refuse writes inside `node_modules/`, `.next/`, `.git/`, `.kimi/`, or `supabase/migrations/` (the last is overridable via `--allow-migration` in code).

## Swarm catalog

| name | role |
|---|---|
| onboarding-coherence | onboarding flow auditor |
| budget-sync-checker | cross-surface number-consistency auditor |
| rls-auditor | Supabase RLS auditor |
| schema-drift | schema-vs-types drift auditor |
| i18n-coverage | i18n key parity auditor |
| dead-code | unused code finder |
| tutorial-stability | tutorial regression scanner |
| prompt-tuner | AI prompt regression catcher |
| a11y | accessibility auditor |
| bundle-size | bundle size auditor |
| copy-tone | copywriting reviewer |
| test-gap | missing-test detector |
| secret-scan | secret detector |
| synthesizer | ranked-action-list synthesizer (auto-tail unless `--no-synth`) |

## Files

```
tools/kimi/
├── pyproject.toml
├── README.md
└── kimi/
    ├── cli.py            # Typer entrypoint
    ├── client.py         # Streaming OpenAI client + usage logging
    ├── config.py         # Models, paths, push policy
    ├── secrets.py        # Keychain → env → .env.kimi
    ├── memory.py         # .kimi/memory.json + cache key
    ├── policy.py         # Secret scan + write/push guards
    ├── catalog.py        # Named swarm agents
    ├── tools/            # Agent-callable tools
    │   ├── fs.py         # read/write/edit/glob/list
    │   ├── search.py     # ripgrep
    │   ├── shell.py      # bounded subprocess
    │   ├── git.py        # status/diff/add/commit/push
    │   ├── vision.py     # screenshot / clipboard / path
    │   ├── verify.py     # lint+tsc+vitest+build
    │   └── registry.py   # tool schemas + dispatch
    ├── agents/           # Loop, chat, engineer, swarm
    └── prompts/          # System prompts for each named swarm agent
```
