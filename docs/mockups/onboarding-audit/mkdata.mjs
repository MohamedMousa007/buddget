// Builds data.json for the audit page from the production graph (real.js) and the simulation (stats.json).
import { readFileSync, writeFileSync } from 'node:fs'
new Function(readFileSync(process.argv[2] + '/docs/mockups/budget-builder-v5/js/real.js', 'utf8'))()
const R = globalThis.Real, st = JSON.parse(readFileSync('stats.json', 'utf8'))
const ans = new Set(R.ANSWERABLE)
const clean = (f) => (f ? f.toString().replace(/\(0, [a-z_0-9]+\.(\w+)\)/g, '$1').replace(/\s+/g, ' ').replace(/^\(s\) => /, '') : '')
const nodes = R.NODES.map((x) => ({ id: x.id, mod: x.mod, control: x.control, tier: x.tier, stake: x.stake, q: x.q, why: x.why, opts: x.opts ?? null, range: x.min !== undefined ? [x.min, x.max] : null, when: clean(x.when), needs: x.needs ?? null, skippable: !!x.skippable, group: x.group, ai: ans.has(x.id), by: st.nodes[x.id].by }))
writeFileSync('data.json', JSON.stringify({ n: st.n, scenarios: st.scenarios, nodes, order: R.MODULE_ORDER }))
console.log(nodes.length, 'nodes', nodes.find((n) => n.id === 'carOverlap').when)
