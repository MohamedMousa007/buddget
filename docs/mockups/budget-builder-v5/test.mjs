// The prototype's one runnable check: node docs/mockups/budget-builder-v5/test.mjs
// Every persona, every mode and every scenario must reconcile to the cent, and known data must remove questions.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
require('./js/real.js')
require('./js/sim.js')
const { Sim, Real } = globalThis
const verbose = process.argv.includes('-v')

const reconciles = (st, label) => {
  const total = Sim.sum(st.lines.map((l) => l.amount))
  assert.equal(total - st.over, st.income, `${label}: lines ${total} - over ${st.over} != income ${st.income}`)
  assert.ok(st.lines.every((l) => l.amount >= 0 && Number.isFinite(l.amount)), `${label}: negative or NaN line`)
}

for (const p of Object.values(Sim.PERSONAS)) {
  const out = {}
  for (const mode of ['guided', 'ai']) {
    const w = Sim.autoWalk(p, mode)
    const st = Sim.settle(Sim.plan(w.hyd, w.flow), {})
    reconciles(st, `${p.id}/${mode}`)
    out[mode] = { screens: w.asked.length, m: Sim.metrics(st), st, w }
  }
  assert.ok(out.ai.screens <= out.guided.screens, `${p.id}: AI mode asks more than guided`)
  const g = out.guided
  for (const id of Sim.SCENARIOS) {
    const r = Sim.runScenario(g.st, id, g.w.hyd, g.w.flow)
    reconciles(r.plan, `${p.id}/${id}`)
  }
  // An over-income edit is repaired without touching locked lines.
  const big = g.st.lines.find((l) => l.block === 'everyday')
  if (big) {
    const d = { ov: { [big.key]: { amount: big.amount + g.st.income, locked: true } } }
    const fixed = Sim.settle(Sim.plan(g.w.hyd, g.w.flow), { ov: Sim.rebalance(Sim.settle(Sim.plan(g.w.hyd, g.w.flow), d), d).ov })
    assert.equal(fixed.lines.find((l) => l.key === big.key).amount, big.amount + g.st.income, `${p.id}: locked line changed`)
  }
  const read = Sim.readSituation(p.story[0], p.cur), readAr = Sim.readSituation(p.story[1], p.cur)
  console.log(`${p.id.padEnd(7)} guided ${String(g.screens).padStart(2)} screens, ai ${String(out.ai.screens).padStart(2)} | income ${g.st.income} over ${g.st.over} buffer ${g.st.buffer} | est lines guided ${g.m.estimated} ai ${out.ai.m.estimated} | risks ${g.st.risks.length} | read en ${Object.keys(read.found).length} ar ${Object.keys(readAr.found).length}`)
  if (verbose) {
    console.log('  asked:', g.w.asked.map((a) => a.head + (a.skipped.length ? '~' : '')).join(' '))
    console.log('  ai asked:', out.ai.w.asked.map((a) => a.head).join(' '))
    console.log('  lines:', g.st.lines.map((l) => `${l.name}=${l.amount}[${l.src}]`).join(' | '))
    console.log('  risks:', g.st.risks.join(' / '))
    console.log('  metrics:', JSON.stringify({ ...g.m, goalsOut: g.m.goalsOut.map((x) => `${x.name}:${x.funded}/${x.need} ${x.months}mo want ${x.want}`) }))
    console.log('  read en:', JSON.stringify(read.found), read.intent, '\n  read ar:', JSON.stringify(readAr.found))
  }
}

// Known data removes questions: the data-rich persona is asked far less than the same person with no history.
const salma = Sim.PERSONAS.salma
const rich = Sim.autoWalk(salma, 'guided').asked.length, cold = Sim.autoWalk(Sim.tweak(salma, { level: 'none' }), 'guided').asked.length
assert.ok(rich < cold, `history should remove questions (${rich} vs ${cold})`)
// Arabic-Indic digits and "alf" read the same as Latin digits.
assert.equal(Sim.readSituation('راتبي ١٨ ألف', 'EGP').found.income, 18000)
assert.equal(Sim.readSituation('I earn 5 alf', 'EGP').found.income, 5000)
assert.deepEqual(Sim.readSituation('I earn 50 a month', 'EGP').flags, ['income'])
console.log(`ok: salma ${rich} screens with history, ${cold} without. Engine ${Real.ENGINE_VERSION}.`)
