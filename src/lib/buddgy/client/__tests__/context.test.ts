import { describe, expect, it } from 'vitest'
import { renderContext, type ContextInput } from '@/lib/buddgy/client/context'

const base: ContextInput = {
  now: new Date('2026-10-19T14:05:00'),
  firstName: 'Sara',
  language: 'ar',
  baseCurrency: 'EGP',
  secondaryCurrency: 'USD',
  cycleStart: '2026-10-01',
  cycleEnd: '2026-10-31',
  cycleDay: 19,
  cycleLength: 31,
  income: 12000,
  spent: 7400.4,
  leftToSpend: 4599.6,
  safeDaily: 380.2,
  pace: 'on_track',
  route: '/expenses',
  sheet: null,
  counts: { debts: 2, subscriptions: 5, goals: 3, paymentMethods: 4 },
  memories: [],
}

describe('renderContext', () => {
  it('renders the compact NOW block', () => {
    const out = renderContext(base)
    expect(out).toContain('2026-10-19 Mon 14:05 · cycle 2026-10-01→2026-10-31 (day 19/31)')
    expect(out).toContain('user Sara · lang ar · base EGP · also USD')
    expect(out).toContain('income 12000 · spent 7400 · left 4600 · safe/day 380 · pace on_track')
    expect(out).toContain('on /expenses')
    expect(out.length).toBeLessThan(500)
  })

  it('leaves out a safe daily amount that is zero, so the model does not read it as "nothing safe to spend"', () => {
    expect(renderContext({ ...base, safeDaily: 0 })).not.toContain('safe/day')
  })

  it('adds the open sheet and remembered facts when present', () => {
    const out = renderContext({ ...base, sheet: 'addDebt', memories: ['saves for a wedding'] })
    expect(out).toContain('on /expenses · sheet addDebt')
    expect(out).toContain('remembered: saves for a wedding')
  })
})
