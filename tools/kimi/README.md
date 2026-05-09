# Kimi CLI

One command. Tell it what you want — it picks the workflow.

```bash
kimi
```

That's it. The agent reads, edits, runs CI, swarms, looks at screenshots, commits — based on the request. For anything non-trivial it proposes a plan first and waits for your `y / n / edit` decision before doing anything.

## Install

```bash
cd tools/kimi
python3 -m venv .venv
source .venv/bin/activate
pip install -e .

# put `kimi` on your PATH globally (optional)
mkdir -p ~/.local/bin
ln -sf "$(pwd)/.venv/bin/kimi" ~/.local/bin/kimi
```

## First run

```bash
kimi doctor   # checks API key, ripgrep, git, model reachability
kimi          # starts chatting
```

API key resolution: `.env.kimi` at project root (already in place) → macOS Keychain item `kimi-api-key`.

## Inside chat

You just type. The agent decides whether the request needs a swarm, a verify loop, a commit, or just a read. For anything beyond a trivial read it shows you a structured plan and asks `proceed? [y / n / edit]` before touching anything.

Slash escapes (rarely needed):

```
/attach <path>   attach a file by path
/clip            attach the clipboard image (macOS)
/shot            interactive screen-grab → vision
/clear           clear chat history
/save            print the session log path
/cost            session token + dollar summary
/exit
```

## Escape-hatch subcommands

You almost never need these — describe what you want in chat instead. They exist for scripting / habit:

```
kimi doctor             health-check
kimi push               push HEAD → origin/dev (refuses main without override)
KIMI_ALLOW_MAIN=1 kimi push --to-main
kimi cost               lifetime + last-session token usage
kimi memory-show
kimi memory-remember "fact"
kimi swarm-list         see the named agents the router can spawn
```

## What the agent has access to

Tools (the agent picks):

- **read tools**: ripgrep (preferred), read_file (line ranges), glob, list_dir, shell, git_status, git_diff
- **write tools**: write_file, edit_file, git_add, git_commit, verify (lint + tsc + vitest + next build with dummy Supabase env)
- **meta tools**: `propose_plan` (always called before non-trivial work), `run_swarm`, `vision_attach`

Swarm catalog (the agent picks the relevant subset):

`onboarding-coherence`, `budget-sync-checker`, `rls-auditor`, `schema-drift`, `i18n-coverage`, `dead-code`, `tutorial-stability`, `prompt-tuner`, `a11y`, `bundle-size`, `copy-tone`, `test-gap`, `secret-scan`, `synthesizer`. Each has its own system prompt under `kimi/prompts/<name>.md` — edit those files to retune any agent.

## Models (override in `.env.kimi`)

```
KIMI_MODEL=kimi-k2.6                              # text + tool-calling
KIMI_VISION_MODEL=moonshot-v1-32k-vision-preview  # screenshots / clipboard
```

Drop newer model names there when Moonshot ships them — no code changes needed.

## How it stays cheap

- ripgrep before reading. Tool outputs capped at 8 KB.
- Stable system prompt + project memory keyed under `prompt_cache_key` so Moonshot's prefix cache reuses them across turns.
- Streaming with Esc abort.
- `reasoning_content` round-tripped automatically (k2.6 is a thinking model and rejects subsequent calls without it).

## Autonomous error recovery

After any edit the agent calls `verify`. On failure the failing CI output is fed back as a tool result and the agent re-enters the loop to fix the cause. Up to 4 attempts.

## Push policy

- `kimi push` only ever targets `dev`.
- `kimi push --to-main` requires `KIMI_ALLOW_MAIN=1` in your shell **and** an interactive `y/n` confirm.
- Secret-regex scan runs over every staged diff before the agent commits.
- Write guards refuse edits inside `node_modules/`, `.next/`, `.git/`, `.kimi/`, `supabase/migrations/`.

## Files

```
tools/kimi/
├── pyproject.toml
├── README.md
└── kimi/
    ├── cli.py            # Typer entrypoint — bare `kimi` drops into router-chat
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
    │   ├── meta.py       # propose_plan, run_swarm, vision_attach
    │   ├── vision.py     # screenshot / clipboard
    │   ├── verify.py     # lint+tsc+vitest+build
    │   └── registry.py   # tool schemas + dispatch
    ├── agents/           # loop, chat (router), engineer, swarm
    └── prompts/          # system prompts for each named swarm agent
```
