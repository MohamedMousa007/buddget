# Buddget — Claude Rules

These rules ap
## Database Sync & Migrations
- **Schema Management:** You have direct access to Supabase. When implementing a new feature or domain change, check `supabase/migrations/` first.
- **Atomic Schema Changes:** 
    - If you add a field to a TypeScript type in `src/lib/store/types.ts` or a mapper, you MUST check if a corresponding SQL migration is needed. 
    - Always use the `execute_sql` tool to apply migration changes immediately.
- **Sync Integrity:** After every schema change, use `mcp generate_typescript_types` (if applicable to your workflow) or manually ensure `src/lib/supabase/database.types.ts` reflects the change.
- **Audit:** Before performing a destructive change (drop/alter column), run a quick `SELECT` to check row counts and identify data loss risks.ply to every Claude session in this repo.

## Workflow
- **Request lifecycle:** classify tier → scope context → execute → verify → auto-push. No plan-approval step.
- **Branching:** Auto-merge `dev` to `main`. No feature branches.
- **Terminal-First:** When debugging or implementing, execute `npm run lint` or `npm run test` directly in the terminal before reporting success.
- **Pre-Commit Verification (MANDATORY):** Before committing or pushing, ALWAYS run and verify:
  1. `npm run lint` — zero errors in `src/` directory (warnings ok, errors block commit)
  2. `npm run test` — all tests pass (79 tests in vitest)
  3. `npm run build` with dummy Supabase env — full production build succeeds
  4. **Code audit** — review the diff for correctness bugs (inverted conditions, null deref, race conditions, wrong variable, missing await, falsy-zero confusion, error swallowing, cross-file contract breaks). Catch issues before they ship.
- **Verification:** Full CI parity locally (lint + test + build) with dummy Supabase env before pushing.
- **Design System:** Before writing or modifying any UI component, read `docs/DESIGN_SYSTEM.md`. All color tokens, spacing, border-radius, touch targets, safe-area classes, and typography must conform to the rules defined there. No hardcoded hex values, no non-standard heights for inputs, no touch targets below 44×44px.
- **Native-Build Ownership (Capacitor):** When modifying code that touches native interfaces, storage, mappers, or plugins:
  - Do not delegate native tasks (such as editing AndroidManifest, Gradle files, Info.plist, or writing Kotlin/Swift) to the user. Execute these edits directly.
  - After ANY web code change that must reach iOS/Android, ALWAYS run `npm run cap:build` — never bare `npx cap sync`. `cap sync` alone copies stale `out/` without rebuilding the web bundle; `npm run cap:build` stashes server-only routes, runs `CAPACITOR=true next build` (static export → `out/`), then syncs to both platforms.
  - Compile the native projects (e.g., via `xcodebuild` or `./gradlew assembleDebug`) to ensure there are no compilation warnings, deprecated API errors, or manifest mismatches before declaring the task complete.
  - **Android APK naming + Drive upload (MANDATORY):** Every APK build must be uploaded to Google Drive via `bash scripts/upload-apk.sh <apk-path>`. The APK filename must include context: pass the Linear ticket ID as the first argument to `scripts/native-release.sh` (e.g. `bash scripts/native-release.sh BUD-123`) so the file is named `buddget-android-vc<N>-BUD-123.apk`; for ad-hoc builds with no ticket, the script auto-generates a slug from the last commit message. Always include the Drive share link in any Linear ticket comment or summary.

## Code Style
- **Enterprise structure:** Clean module boundaries, single-responsibility files.
- **Clean Code:** No defensive checks for impossible states. No backwards-compat shims for unreleased code. No comments that restate the code.
- **Mobile-First:** Ensure all UI updates account for safe-area-insets and touch targets (44x44px+).

## Token Economy (Strict)
- **Output:** Respond with code and a maximum 2-sentence explanation.
- **Snip Output:** When providing code, use `Edit` tool/diffs. Never output full files unless a file is created from scratch.
- **Silent Execution:** Minimize commentary between tool calls. 
- **Efficiency:** Do not re-read files already read this turn. Do not re-verify info you already have in context.
- **Parallelism:** Parallelize independent tool calls in a single block.
- **No Fluff:** No preambles, no emojis, no decorative headers, no bullet lists for short responses.

## Interaction Protocol
- **Constraint:** Treat these rules as hard boundaries. 
- **Goal:** Correctness > Brevity, but always prioritize minimal token consumption.
## Database Sync & Migrations
- **Schema Management:** You have direct access to Supabase. When implementing a new feature or domain change, check `supabase/migrations/` first.
- **Atomic Schema Changes:** 
    - If you add a field to a TypeScript type in `src/lib/store/types.ts` or a mapper, you MUST check if a corresponding SQL migration is needed. 
    - Always use the `execute_sql` tool to apply migration changes immediately.
- **Sync Integrity:** After every schema change, use `mcp generate_typescript_types` (if applicable to your workflow) or manually ensure `src/lib/supabase/database.types.ts` reflects the change.
- **Audit:** Before performing a destructive change (drop/alter column), run a quick `SELECT` to check row counts and identify data loss risks.
- **Context Sync:** Always read `CLAUDE_CONTEXT.md` at the start of the session to align with the current architecture, design system tokens, and database state before writing code.

