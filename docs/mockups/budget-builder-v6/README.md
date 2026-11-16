# Budget Canvas (v6 prototype)

A from-scratch redesign of first run and the budget builder. It does not use the existing flow or the production budget engine. Published as a Claude Artifact: https://claude.ai/artifact/UNnZJAsPqA5UXJZcgTjqWj

The earlier prototype (v5, which ran the production engine) is kept unchanged in `../budget-builder-v5` and at its own link.

Status (2026-11-15): awaiting owner review. No production code, migration or schema was changed. The decision record and the open questions are in the artifact's Decisions tab (`js/lab.js`, `renderDec`).

| File | Role |
|---|---|
| `js/engine.js` | The new deterministic engine: facts to a balanced budget, edits and rebalancing, outcomes, value-of-information question ranking, shapes, what-ifs. |
| `js/data.js` | Six fictional personas by data level, the simulated AI (reading words, reading "adjust" requests). |
| `js/i18n.js` | English and Arabic copy, including the engine's keyed reasons. |
| `js/app.js` | Every phone screen. |
| `js/lab.js` | Persona rail, inspector, flow map, simulation lab, decisions. |
| `test.mjs` | Reconciliation and behaviour checks. |

```bash
node docs/mockups/budget-builder-v6/test.mjs -v
```

Preview locally with the `budget-canvas-v6` entry in `.claude/launch.json` (port 4176). Republish from `index.html` with the five `js/` files.
