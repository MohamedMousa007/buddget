# Jobs 10 and 12, and the sync rerun

Checked 2026-11-20 against: the transcript of the session "Fable 5 prioritization strategy" (where the jobs were issued and their results pasted), `git` on `origin`, and one read-only catalog query on the live database.

## What they are

They are **not scheduled database jobs.** `docs/SCHEDULED_JOBS.md` has no job numbers; its 15 pg_cron jobs are all active on live (count checked) and none of them is "10" or "12". The numbers are jobs sent to the **cloud QA runner** ("qa-runner: round 2 fix branches gate + live suites") during QA round 2.

| Name | What it is | Branch and commit |
|---|---|---|
| Job 10 | Tap-area sweep of the Pro, Rewards, Invite, Founders and Settings screens (`e2e/ui/pro-rewards-sweep.mjs`) on main, with the repaired sweep script | `main` at `eed68a8` |
| Job 12 | Gate for the S8a money-path fixes: `npm run verify`, the pro-rewards API suite, the `qa-regressions` suite | `claude/s8a-qa-fix-review-2159fb` at `b25a832` |
| Sync rerun | Rerun of the sync fix branch: `npm run verify`, the live adversarial sync tests, journeys R13, R14, R16, R17 | `claude/ecstatic-shamir-e2f695`; run four times as jobs 7, 9, 13, 18 |

## Status

"Ran" and "passed" are different things, so they are separate rows. Cron rows do not apply.

| Dimension | Job 10 (tap sweep) | Job 12 (S8a gate) | Sync rerun |
|---|---|---|---|
| Identified and scoped | yes | yes | yes |
| Executed | yes | yes | yes, jobs 7, 9 and 13 |
| Passed | **no** | **no** (verify failed) | **no** |
| Follow-up run | job 20 on `e48fbcb6`: queued, **result not seen** | job 19 on `0713c539`: queued, **result not seen** | job 18 on `fb961c48`: queued, **result not seen** |
| Fix code committed | yes, `claude/elastic-poitras-06d803` | yes, branch above | yes, branch above |
| On dev | no | no | no |
| On main | no (1 commit ahead of main) | no (7 commits ahead) | no (15 commits ahead, 38 files) |
| Migration applied on live | none needed | 0335 and 0336: **applied** (3 of 3 sampled check constraints and `trial_claims_user_uidx` exist) | 0331 and 0334: `private.reject_stale_write` exists on live; the session says both are applied |
| Migration files on main | n/a | **no** | **no** |
| Production schedule enabled / execution observed | not applicable (not a scheduled job) | not applicable | not applicable |
| Correct behaviour verified | no | partly | no |

**One-word answers:** job 10 = *executed, not passed, rerun pending*. Job 12 = *executed, not passed, rerun pending*. Sync rerun = *partially complete*: executed three times, still failing, fourth run pending.

### Job 10 result (ran on main)
- 48 pages, 0 accessibility violations, 0 sideways scroll, 9 tap misses, **29 errors**.
- The 29 errors: Arabic never took effect in the sweep, so all 24 Arabic pages errored. The sweep **cannot measure Arabic yet**.
- Real defect reported: on `/settings` at 375 px, the bottom ~21 px of "Data & backup", "Sign out" and "Sign-in & security" stay behind the nav's Quick add button. The UI session believes this was the sweep measuring during a smooth scroll (the page has 136 px bottom padding); job 20 is meant to settle it.
- The sweep misses a sign-out that happens after its first check.

### Job 12 result (S8a branch)
- `npm run verify`: **failed**, 1 of 6579. `email.test.ts:88`: the new rule refuses webhook keys under 16 bytes and the test signed with a 3-byte key. A test fault, fixed in `0713c539` (32-byte key); not rerun yet as far as this record shows.
- pro-rewards API: 80 passed, 1 failed (H3, a dev-server compile glitch, passed 2 of 2 reruns), 1 skipped (needs `REVENUECAT_IGNORE_SANDBOX=1`).
- `qa-regressions`: 17 of 17.
- Nine S8a fixes (forged-SMS trust, one trial per account, NaN/Infinity on 25 money columns, webhook hardening) are **on the branch only**.

### Sync rerun result (latest seen: job 13 at `3076725`)
- `npm run verify`: **failed**, 2 of 6573 (OFS-6 clock test, S-7 vault test). Both were judged test-setup faults and changed in `fb961c48`.
- Live adversarial sync tests: 12 of 12, twice.
- R13 (offline sign-out): fails as the first test after a cold server (signed out right after sign-in), passes warm. `fb961c48` removes a 20 s device-check timeout the sync session had added.
- **R14 (two devices): failed 2 of 3.** Each device ends with one live expense, but not the same one. `fb961c48` only lengthens the test's wait to 40 s; it does not change app code for this.
- **R17 (writes on every reload): failed.** Each reload re-posts `user_settings`, `payment_methods`, `profiles` and `expenses` although nothing changed. `fb961c48` sends an update only if the server row would change.

## Can a retry or rerun of sync lose, duplicate or skip changes? (BDG-H2)

Yes, on today's main. These are open on main because the sync branch is not merged:
1. **Two devices can end in different states** (R14). Not fixed in app code as far as the record shows.
2. **Every reload rewrites whole rows from local state** (R17), including the full `user_settings` row, which carries `theme` and has no `edited_at`. A device holding an older value can overwrite a newer one. This is the leading candidate for BDG-001 (theme reverts); see `findings/A-settings.md`.
3. **A row saved while a pull is running can be marked as sent** (S-1), so it never uploads. Fixed on the sync branch only.
4. **A pocket can be pushed before the account that holds it**, the server rejects it on a foreign key and the app sets 3 items aside (found by job 17). Fixed on the sync branch only.
5. **Undo after delete can lose to the delete** (D-5). Fixed by migration 0334, applied on live.

## Two things the owner should know

1. **Live is ahead of main.** Migrations 0331, 0334, 0335 and 0336 are applied on the live database, but their files and the app code written for them are only on unmerged branches. The app users run today (main, iOS 146, Android vc180) was not written against the 0331/0334 write rules. The planned merge order is sync, then S8a, then S-2, then a build.
2. **The results of jobs 18 to 21 are not in any session on this Mac.** The runner cannot message back; its answers appear only in its own chat on claude.ai/code. Until they are pasted, "sync is green" is unknown.

## Not verified
- Whether jobs 18 to 21 have run, and their results.
- The exact body of `private.reject_stale_write` on live against the 0334 file (existence checked, not content).
- Sync on a real device: every run above is a browser on the cloud runner.
