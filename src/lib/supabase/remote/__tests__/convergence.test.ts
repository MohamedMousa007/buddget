import { describe, expect, it } from 'vitest'
import { flushDiff } from '@/lib/supabase/remote/sync'
import { emptySnapshot, type Snapshot } from '@/lib/supabase/remote/snapshot'
import { applyDelta } from '@/lib/supabase/remote/delta'
import type { Expense } from '@/lib/store/types'
import { expenseAt, fakeEditTimeServer } from './fakeEditTimeServer'

const T0 = Date.UTC(2026, 0, 1)
const MIN = 60_000
const snap = (e: Expense[]): Snapshot => ({ ...emptySnapshot(), expenses: e })

function rng(seed: number) {
  let x = seed >>> 0
  return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32)
}

class Device {
  exp: Expense[] = []
  prev: Snapshot = emptySnapshot()
  cursor: number | null = null
  constructor(readonly name: string) {}
  /** What `pendingSync` does: flush, then pull the delta and merge against the delivered baseline, then re-baseline. */
  async sync(s: ReturnType<typeof fakeEditTimeServer>) {
    const next = snap(this.exp)
    await flushDiff(s.client as never, 'u', this.prev, next)
    this.prev = next
    const d = s.delta(this.cursor)
    this.exp = applyDelta(snap(this.exp), d, this.prev).expenses
    this.cursor = Date.parse(d.cursor)
    this.prev = snap(this.exp)
  }
}

async function run(seed: number, steps = 60) {
  const r = rng(seed)
  const clock = { now: T0 }
  const s = fakeEditTimeServer(clock)
  const devs = [new Device('A'), new Device('B'), new Device('C')]
  const newest = new Map<string, { amount: number; at: number }>()
  const deleted = new Set<string>()
  let nextId = 0
  let nextAmount = 1
  for (let i = 0; i < steps; i++) {
    clock.now += 3 * MIN * (1 + Math.floor(r() * 5))
    const d = devs[Math.floor(r() * devs.length)]
    const p = r()
    if (p < 0.2) {
      const id = `${d.name}${nextId++}`
      d.exp = [...d.exp, expenseAt(id, nextAmount, clock.now)]
      newest.set(id, { amount: nextAmount++, at: clock.now })
    } else if (p < 0.5 && d.exp.length) {
      const row = d.exp[Math.floor(r() * d.exp.length)]
      d.exp = d.exp.map((x) => (x.id === row.id ? { ...x, amount: nextAmount, updatedAt: new Date(clock.now).toISOString() } : x))
      newest.set(row.id, { amount: nextAmount++, at: clock.now })
    } else if (p < 0.58 && d.exp.length) {
      const row = d.exp[Math.floor(r() * d.exp.length)]
      d.exp = d.exp.filter((x) => x.id !== row.id)
      deleted.add(row.id)
    } else if (p < 0.68) {
      const ids = [...s.rows.values()].filter((x) => !x.deleted_at).map((x) => x.id)
      if (ids.length) s.serverWrite(ids[Math.floor(r() * ids.length)], { description: `server-${i}` })
    } else await d.sync(s)
  }
  for (let k = 0; k < 3; k++) for (const d of devs) { clock.now += 3 * MIN; await d.sync(s) }
  return { devs, s, newest, deleted }
}

describe('3 devices, seeded interleavings of add / edit / delete / server writer / sync (300 seeds x 60 steps)', () => {
  it('every device converges on the server, and the newest edit by edit time wins on every row that was never deleted', async () => {
    const divergent: number[] = []
    const lost: number[] = []
    for (let seed = 1; seed <= 300; seed++) {
      const { devs, s, newest, deleted } = await run(seed)
      const live = [...s.rows.values()].filter((x) => !x.deleted_at).map((x) => `${x.id}:${x.amount}`).sort().join('|')
      if (devs.some((d) => d.exp.map((x) => `${x.id}:${x.amount}`).sort().join('|') !== live)) divergent.push(seed)
      for (const [id, e] of newest) {
        if (deleted.has(id)) continue
        if (s.rows.get(id)?.amount !== e.amount) { lost.push(seed); break }
      }
    }
    expect({ divergent, lost }).toEqual({ divergent: [], lost: [] })
  }, 120_000)
})
