# Buddget remediation program: index and status

**Status, 2026-11-20:** investigation, fix plan, Council and independent audit are done. **Nothing is built and no test has been run.** Waiting for the owner's decisions.

Lead: Claude Fable 5.2 (the brief names Opus). Eight read-only investigators (Opus and Sonnet), three Council voices and one independent auditor (Opus).

## Documents

| File | What it holds |
|---|---|
| `01-issue-register.md` | the 28 issues, what the owner expects, risk tier |
| `02-backend-job-status.md` | jobs 10 and 12, the sync rerun |
| `03-root-cause-analysis.md` | one row per issue, confirmed or hypothesis |
| `04-cross-system-dependencies.md` | ten shared causes, dependency graph |
| `05-fix-plan.md` | the plan, revision 2 |
| `06-council-review.md` | nine decisions, four voices, verdicts |
| `07-independent-plan-audit.md` | the audit and the lead's response |
| `08-playwright-test-plan.md` | test cases by risk tier |
| `09-playwright-results.md` | baseline status (blocked) and standing evidence |
| `10-native-test-requirements.md` | what needs a phone |
| `findings/A` to `G` | the investigators' evidence with `path:line` |
| `progress.md` | handoff for a new session |
| `11-implementation-report.md` | after approval |

## A. Summary

**Most serious**
1. **Buddgy was silent for 8 days.** 8 to 16 November: every quick-tier call failed (26 calls, 5 users) on one model. Gone since the model changed. Nothing alerted anyone.
2. **Buddgy can charge for nothing** on seven code paths, charges each tool step separately, and charges Retry again. Live rows show no failed call charged in the last 14 days, so this is a confirmed risk, not yet an observed loss.
3. **"This chat is getting long" is a cost meter.** Reachable in 2 to 4 turns, and the same flag cuts Buddgy's memory to 2 items.
4. **No purchase can complete today.** No store event has reached the database in 30 days; store setup is unfinished. The app also shows "Welcome to Pro" without a verified purchase.
5. **SMS setup shows a claim as fact.** "Automation active" appears without any SMS; 2 of 7 collecting iPhones have never delivered one.
6. **Theme:** System is saved as dark, the client's fallback is dark, and settings sync as one whole row.
7. **Sync on main can still leave two devices different** (R14), and the live database is ahead of main.

**Working:** reward rules in SQL; anti-abuse; plan offers per tier; the stay offer code; all 15 scheduled jobs; out-of-order store events are already rejected; no card number or CVV exists anywhere in the app.

**Shared causes:** ten, in `04`. The four that matter most: whole-row settings sync; one spend counter doing two jobs; the chat staying open while the app navigates beneath it; success shown from a local claim.

## B. Jobs 10, 12 and the sync rerun
They are cloud QA runner jobs, not scheduled jobs.
- **Job 10** (tap-area sweep on main): **executed, not passed.** Rerun queued as job 20, result not seen.
- **Job 12** (S8a fixes): **executed, not passed** (one test fault; suites passed). Rerun queued as job 19, result not seen. Code not on dev or main; its migrations are applied on live.
- **Sync rerun:** **partially complete.** Executed three times, still failing (R14, R17). Fourth run queued as job 18, result not seen. Code not on dev or main; its migrations are applied on live.

## C to F
Root causes: `03`. Plan and order: `05`. Council: `06`. Audit: `07`.

The audit rejected two items and changed eleven. The biggest change: the Buddgy charging fix was split so the first slice runs on the server and protects builds already installed.

## G. Test coverage
- Cases specified: about 34 (22 unit, 4 API or SQL, 8 journeys) across 19 issues. 9 issues are owner review.
- Cases written: 0. Run: 0. Passing: n/a.
- Blocked: baseline (no reachable runner); end-to-end billing (store setup).
- Device-only checks: 10 rows across 6 issues.
- Screenshots and traces: none yet.

## H. What could not be proven here
- Whether the owner's lost Buddgy usage was charged during the outage (older counters are gone).
- Why no store package loads on the owner's phone.
- The card-flip cause (needs an iPhone).
- That iOS cannot inspect Shortcuts (no Apple page says so).
- Results of runner jobs 18 to 21.
- Whether a stale device can still overwrite settings after the sync merge.
- Every finding outside BDG-001's mapper line and the live counts was read by one investigator; the auditor re-read 11 of them in code.

## I. Decisions the owner needs to make

**Actions**
1. Paste the runner's results for jobs 18 to 21.
2. Finish store setup: agreements, banking and tax; In-App Purchase key in RevenueCat; two webhook secrets on Vercel.
3. Give this program a cloud QA runner it can reach.
4. Install an iOS simulator runtime, or plan on your own phone for the device checks.

**Rulings**
1. Buddgy charging: accept "free unless you saw text or an action was applied"? Is a written refusal charged? Reset testers' AI windows once?
2. SMS: does a Shortcut run turn "Set up" into the switch, or only finishing the guide or confirming the skip?
3. Theme: store System on the server (one migration, recommended) or drop System from the tile?
4. Buddgy: keep the chat across a reload and past 30 idle minutes?
5. Buddgy: "Build my budget here" now, or only "Open Budget Builder" until a chat path exists?
6. Buddgy orb: hint or no hint?
7. Invites: no expiry (recommended); landing page before a share image? A qualifier on "37 days"? A shorter real code or only the sample?
8. Streak strip: calendar or progress meter?
9. Setup bar: call it "Finish setup", or build true profile completion?
10. Biometrics and App lock: which screen?
11. Bank logos: neutral icon only, or real logos with the trademark risk? Account mark on transaction rows?
12. Card faces: a second look on the existing chip, or one shared component?
13. Savings pickers: `SelectField`, a new picker sheet, or fix "Into" only?
14. Are a web payment rail and Android selling in scope?
15. Back buttons on the six screens that lack one (recommended)?

## Roadmap after approval
Phase 0 preconditions, then server-only fixes (they reach installed builds at once), then the P1 tracks in parallel, then interactions, then visual items after mockups, then one native build and the device checklist. Detail in `05`.
