# QA Round 5: LIV (live UI)

Covered: setup of the browser harness (dev server on :3001 with `NEXT_PUBLIC_DEV_AUTH_BYPASS=1`, axe copied to `public/`, `scripts/qa/ui-sweep.js` read). NOT covered: every item in the assignment (dark/Arabic sweeps, keyboard sweep, 320/768/1024 widths, stress data, empty states, skipped routes, CRUD flows, double-submit, back button, reload mid-flow). The live sweep could not run: see LIV1.

| ID | P | file:line | finding | evidence | suggested fix | status |
|---|---|---|---|---|---|---|
| LIV1 | P3 | dev tooling (`next dev --webpack`), `.claude/launch.json` `buddget-qa-local` | The first `/flow` request in dev did not serve within about 15 minutes on a loaded host (load average 16 to 18 from parallel agents). Run 1: `GET /flow 200 in 2.1min`, then the next request returned HTTP 500 `SyntaxError: Unexpected end of JSON input` (page `/flow`, JSON.parse, dev server log), and the browser pane showed an empty alert. After deleting `.next/dev` and restarting, `/flow` compiled for over 10 minutes with no response; curl timed out at 290s and the pane navigate timed out at 300s. `/flow` was also redirected to the marketing landing page once in run 1 (the page title changed to "Buddget: see where your money goes"). | dev server log, browser pane (tab "seed"). Environment issue, not proven to be an app defect; the 500 may come from a stale `.next` containing production build files (BUILD_ID dated earlier) beside `.next/dev`. | Run the live UI sweep on a quiet machine or against a production build; consider a `next build && next start` QA config so routes do not compile on first hit. | Static (environment) |

No app defects were confirmed in this pass. The assignment's flows remain untested and should be repeated.

Cleanup done: dev server stopped (port 3001 free), `public/qa-axe.min.js` deleted, no files left under `src/__qa5__/`. The `src/` changes shown by `git status` belong to other agents.

Coverage: read fully: BRIEF.md, QA_ROUND_4.md, scripts/qa/ui-sweep.js, DevAuthBypassSeed.tsx. Skimmed: the three QA skill files, store action list in `src/lib/store/types.ts`. Not exercised: all routes and sheets.
