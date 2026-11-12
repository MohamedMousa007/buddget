# Buddget — Claude Rules

Extends the global master at `~/.claude/CLAUDE.md` (behaviour, token economy, code style). These are Buddget-specific and win on conflict.

## Session start
- Read `CLAUDE_CONTEXT.md` for architecture, design tokens and DB state.
- DB-first: run `list_migrations` / `list_tables` on Supabase project `ydihurtbcnoflhormgzi` and confirm the live schema matches `src/lib/supabase/database.types.ts`.

## Workflow
- Lifecycle: classify tier -> scope context -> execute -> verify -> auto-push. No plan-approval step.
- Branching: auto-merge `dev` into `main`. No feature branches.
- Gate: `npm run verify` must pass before pushing to dev/main and before any native build (lint, types, tests in Cairo with coverage floor and New York, migration check, dependency audit, production build with dummy Supabase env). Lint errors in `src/` block commit; warnings are fine.
- Plus a diff audit for correctness bugs before every push.
- GitHub Actions is not relied on.
- Parallel sessions can share this checkout: `git add` only your own paths, never `-A`.
- After pushing, confirm it landed (`git log origin/main -1`). A denied push is the first line of the summary.

## Database & migrations
- New feature or domain change: check `supabase/migrations/` first.
- Order: migration -> apply with `execute_sql` -> regenerate `database.types.ts` -> then code. Never write UI against a column the live DB lacks.
- Adding a field to a type in `src/lib/store/types.ts` or a mapper: check whether a SQL migration is needed.
- Before drop/alter column: run a `SELECT` for row counts and data-loss risk.

## UI & design system
- Read `docs/DESIGN_SYSTEM.md` before touching any UI. Tokens only: no hardcoded hex, inputs at standard heights, touch targets 44x44px minimum, safe-area classes.
- Reuse first: search `src/components/ui` and `src/components/features` (heroes use `HeroBand`; sheets, chips, cards, rows have primitives) and name what you reused. A composition of existing parts is not a new component.
- Handoffs and "no deviation" do not bypass reuse; only the user saying so does. If the design can't be built from existing components, or needs a significant size/structure change, raise an alert and wait.
- Never reshape an existing component. Variation = additive variant/prop with unchanged default. Allowed edits: bug, accessibility and token fixes, with tests, same default look, and a note to the user.
- A component's 3rd or 4th variant: propose promoting it to its own component.

## Native builds (Capacitor)
- Do native edits (AndroidManifest, Gradle, Info.plist, Kotlin/Swift) yourself; never delegate them to the user.
- Web bundle for native comes from `npm run cap:build`, never bare `npx cap sync`.
- Builds are never automatic and always local. Start a build, TestFlight upload or Drive upload only when the user's own message this turn says to build/upload apps; ambiguous wording = ask. Not after a code change, not because a script or button mentions it.
- On "build and upload apps" (or equivalent): always both iOS and Android, never ask which, on this Mac, via `bash scripts/native-release.sh [label]` (cap:build, iOS archive + TestFlight, Android APK to Drive, version bumps committed with `git add -f` and pushed to dev and main). Report TestFlight status and the Drive link.
- Never dispatch `ios-release.yml` / `android-release.yml`. Prerequisites are in the header of `scripts/native-release.sh`; the working tree must be clean and pushed first.
- The Linear bot (`scripts/linear-bot.sh`) is inactive.
