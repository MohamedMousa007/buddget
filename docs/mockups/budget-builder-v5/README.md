# Budget Builder v5 prototype

Interactive proof of concept for first-run setup and the Budget Builder. Published as a Claude Artifact: https://claude.ai/artifact/Am4V1JRxgSSAsHiqdvcamz

Status (2026-11-15): awaiting owner review. No production code, migration or schema was changed. The decision record, engine findings and the open questions live in the artifact's Decisions tab (`js/lab.js`, `renderDec`).

## What runs what

| File | Role |
|---|---|
| `entry.ts`, `build.mjs` | Bundle the production modules (`src/lib/budget` engine, benchmarks, question graph, answers-to-facts, reader validator, flow copy) into `js/real.js`. Generated, do not edit. |
| `js/sim.js` | Fictional personas, hydration by data level, simulated AI (reader and "adjust"), draft edits, metrics, what-if scenarios. |
| `js/phone.js` | Every phone screen from sign-in to an active budget. |
| `js/i18n.js` | English and Arabic copy for the new screens; pattern translation of the engine's English-only reasons. |
| `js/lab.js` | Persona rail, inspector, flow map, simulation lab, decisions. |
| `test.mjs` | Reconciliation check for six personas, two question modes and nine scenarios. |

## Commands (from the repo root)

```bash
node docs/mockups/budget-builder-v5/build.mjs
```

```bash
node docs/mockups/budget-builder-v5/test.mjs -v
```

Preview locally with the `budget-builder-mockup` entry in `.claude/launch.json` (static server on port 4175). After changing anything under `src/lib/budget`, rebuild, re-run the test and republish the artifact from `index.html` with the five `js/` files.
