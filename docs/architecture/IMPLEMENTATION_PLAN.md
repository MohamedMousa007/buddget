# Phase A/B implementation (2026-11-27)

Scope agreed by council (Architect, Skeptic, Pragmatist, Critic) on the owner's "apply the changes; complete partly done items where they fit". Findings: [application-architecture-audit.md](application-architecture-audit.md#8-finding-register).

## In this PR

| Area | Items | Owner |
|---|---|---|
| Database (migration `0352_perf_audit_phase_a.sql`, applied live 2026-11-27) | F-01 lock-free tier refresh; F-14 drop 4 duplicate indexes; F-05 avatar CHECK; F-13/F-16 directory id tie-break + optional total | Opus (main session) |
| Server caching, AI gate, rate limits, welcome | F-03, F-09, F-26, F-18, F-19 | Sonnet agent A |
| Admin portal | F-06, F-07 (uniform reply), F-08, F-12 (stale-while-revalidate + client invalidation), F-13 (offset cap, no total for type-ahead), F-16 (admin cursors), F-20 (bulk toggle step-up) | Sonnet agent B |
| Sync, client data, images | F-10a, F-15, F-04, F-21 (notifications, push, SMS loop hoist), F-16 (app lists), F-17 (delete unused PNGs, lazy logos) | Sonnet agent C |
| Docs | F-27, F-29, report status | Opus |

Tests are written for deep items and not run (owner rule 2026-11-24). Type-check and diff audit before the PR.

## Status (2026-11-27)

- Database: migration 0352 applied live and checked (one `admin_user_directory` overload, service-role only; avatar CHECK validated, with the largest live avatar at 163,743 characters; the 4 indexes are gone; total is skipped when asked; advisors unchanged). Re-running it on a restored copy fails at `VALIDATE` only if some avatar exceeds 300,000 characters; trim those first.
- Code: type-check clean, ESLint 0 errors. An independent diff review (`_work/W5-diff-review.md`) found no bug; its four risks were fixed: quota release when the receipt body fails to read, bounded memory gate, an IPv6 /64 key on the site, lead and price-refresh limits, and the avatar note above.
- Tests (owner asked, 2026-11-27): **Automated verification passed.** `npm run verify` is green (7,928 unit tests in Cairo and New York, coverage floor, migration check, audit, build). Cloud e2e: pro-rewards 83/83 after one re-run of 2 flaky specs unrelated to this PR, admin-devices 4/4, support loop 6/6, live sync 21/21, 0 synthetic users left ([report](../qa/perf-audit-phase-a-e2e.md)). **Manual verification required:** the admin sign-in reply and the lazy logos.
- Behaviour changes to know:
  - A locked staff account now sees the generic sign-in error for 15 minutes, with no "locked" message.
  - Admin SMS and email log tabs that are already open restart at page 1 once.
  - The second mounted notifications list can be up to 30 s old.
  - Plan and flag edits apply after cache invalidation.

## Deferred (council), with trigger

| Item | Why not now | Trigger |
|---|---|---|
| Skeleton consistency across views | UI change: needs an owner-approved mockup | Owner approves a mockup, or a view is reported showing zeros |
| Lazy-load the 33 shell views | Static on purpose (WebView wedge); no bundle numbers | Bundle report plus device test |
| Image recompression / resizing | Pixels change: UI approval | Mockup or visual diff approved |
| F-10b paged first pull | XL; accounts are small | Full pull > 2 MB or > 3 s |
| F-01 full split (upkeep out of the read) | Hidden ordering dependencies | Mean still > 100 ms after this PR |
| F-11 month-carry refactor, F-22 sweep cursors | Fine at 58 users | About 100-200 due users, or a run past half its budget |
| F-23 audit-log partitioning, F-24 batched wipe/export, F-25 sender index | Tiny tables | Row triggers in the roadmap |
| Stats snapshot cron | Nobody reads it yet | Public launch; run the saved query by hand until then |
| BUD-94 in-app confirm revert (dissent: 3 voices said do now) | Code marks it temporary *until public launch*; still pre-public | Before public launch (owner) |
| F-07 progressive / (account, IP) lockout | Schema change on admin credentials | After the uniform reply ships |
