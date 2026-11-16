// The prototype's one runnable check: node docs/mockups/budget-builder-v6/test.mjs [-v]
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
require('./js/engine.js')
require('./js/data.js')
const { Engine: E, Data: D } = globalThis
const v = process.argv.includes('-v')
const ok = (st, label) => {
  const total = E.sum(st.lines.map((l) => l.amount))
  assert.equal(total - st.over, st.basis, `${label}: lines ${total} - over ${st.over} != basis ${st.basis}`)
  assert.ok(st.lines.every((l) => Number.isInteger(l.amount) && l.amount >= 0), `${label}: bad amount`)
}
for (const p of Object.values(D.PERSONAS)) {
  const w = D.walk(p)
  const st = E.settle(E.build(w.input)), m = E.metrics(st)
  ok(st, p.id)
  ok(E.settle(E.build(D.known(p))), p.id + '/start')
  for (const s of E.shapes(w.input)) ok(s.st, `${p.id}/shape ${s.id}`)
  for (const id of E.SCENARIOS) ok(E.runScenario(w.input, {}, id).st, `${p.id}/${id}`)
  // Pinning a line far above its amount rebalances from wants and never touches the pinned line or an essential.
  const g = st.lines.find((l) => l.key === 'groceries')
  if (g) {
    const s2 = E.settle(E.build(w.input), { pins: { groceries: g.amount + 1000 } })
    ok(s2, p.id + '/pin')
    assert.equal(s2.lines.find((l) => l.key === 'groceries').amount, g.amount + 1000)
    for (const l of st.lines.filter((x) => x.essential && x.key !== 'groceries')) assert.equal(s2.lines.find((x) => x.key === l.key).amount, l.amount, `${p.id}: essential ${l.key} trimmed`)
  }
  const rEn = D.read(p.story[0], p.cur), rAr = D.read(p.story[1], p.cur)
  console.log(`${p.id.padEnd(7)} ${String(w.steps.length - 1).padStart(2)} cards, own ${w.steps[0].own}% -> ${m.own}% | basis ${st.basis} over ${st.over} | risks ${E.risks(st).length} | read en ${Object.keys(rEn.facts).length} ar ${Object.keys(rAr.facts).length}`)
  if (v) {
    console.log('  path:', w.steps.slice(1).map((s) => `${s.id}${s.core ? '*' : ''}(${s.impact})->${s.own}%`).join(' '))
    console.log('  lines:', st.lines.map((l) => `${l.key}=${l.amount}[${l.conf}]`).join(' '))
    console.log('  risks:', E.risks(st).map((r) => r[1]).join(' '), '| goals:', m.goalsOut.map((x) => `${x.name} ${x.months}/${x.want}`).join(' '), '| debtFree', m.debtFree, '| safetyFull', m.safetyFull)
    console.log('  read:', JSON.stringify(rEn.facts), '\n  readAr:', JSON.stringify(rAr.facts))
  }
}
// Fixes the v5 findings: no double-counted utilities, essentials survive a deficit, a low floor does not crush groceries.
const salma = E.settle(E.build(D.walk(D.PERSONAS.salma).input))
assert.ok(!salma.lines.some((l) => l.key === 'utilities'), 'utilities double counted')
const mona = E.settle(E.build(D.walk(D.PERSONAS.mona).input))
assert.ok(mona.over > 0 && mona.lines.find((l) => l.key === 'groceries').amount > 0, 'deficit hides essentials')
const omar = E.settle(E.build(D.walk(D.variant(D.PERSONAS.omar, { lowMonth: 18000 })).input))
assert.ok(omar.lines.find((l) => l.key === 'groceries').amount >= 1800, 'floor crushed groceries')
// History removes questions; Arabic digits and "alf" read correctly; implausible income is flagged.
assert.ok(D.walk(D.PERSONAS.salma).steps.length < D.walk(D.variant(D.PERSONAS.salma, { level: 'none' })).steps.length)
assert.equal(D.read('راتبي ١٨ ألف', 'EGP').facts.income, 18000)
assert.deepEqual(D.read('I earn 5 a month', 'EGP').flags, ['income'])
console.log('ok')
