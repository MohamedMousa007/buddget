import { describe, expect, it } from 'vitest'
import type { AccountAdjustment } from '@/lib/store/types'
import { computeBalances } from '@/lib/accounts/balance'
import { revertAchievedForMonthEndUndo } from '@/lib/goals/reconcileAchievedGoals'
import { leftover, type SummaryWindow } from '../leftover'
import { planContext, ratesConverter } from '../context'
import { C_END, DEC, NOV, R50, at, dayOf, expense, fixture, income, part, tx, type World } from './fixtureF'
import { applyPasses, completedGoals, propose, readSplit, undoAmounts, undoBlocked, validateSplit, type PlanLine, type SplitEntry } from '../proposal'

/**
 * LOGIC_SPEC §6 P6 rows (T23, T26–T40, T46, T47, N1–N3, N5, N9, N10) on fixture F, dates in 2025 like P1–P5. Cycle C =
 * Nov 1–Dec 1. Balances are read at explicit local instants; the card (statement close 10th) holds back 6,000 until Dec 10.
 */
const SPLIT: SplitEntry[] = [{ target_id: 'car', pct: 50 }, { target_id: 'travel', pct: 20 }]

const figures = (w: World, cycle = NOV, summaries: SummaryWindow[] = [], rates = R50) =>
  leftover({ cycle, base: 'EGP', convert: ratesConverter(rates, 'EGP'), dayOf, summaries, ledger: { ...w.ledger, convert: ratesConverter(rates, 'EGP') } })
const ctxOf = (w: World, now: number, rates = R50) => planContext({ userId: 'u1', base: 'EGP', rates, ledger: w.ledger, goals: w.goals, cycleEnd: C_END, now })
const proposeFor = (w: World, now = at(12, 1, 9), split = SPLIT, rates = R50) => propose(figures(w).leftover, split, ctxOf(w, now, rates))
const caps = (w: World, now: number, rates = R50) => Object.fromEntries(ctxOf(w, now, rates).accounts.map((a) => [a.id, a.cap]))
const brief = (lines: readonly PlanLine[]) => lines.map((l) => [l.target.kind === 'ms' ? 'ms' : l.target.id, l.accountId, l.amount])
const free = (w: World, id: string, asOf: number) => computeBalances(w.ledger, asOf).get(id)!

/** Confirm: the labels apply_month_end writes (one month_end deposit per line) and the parts they move. */
function applyLabels(w: World, lines: readonly PlanLine[], date = '2025-12-01') {
  for (const l of lines) {
    const p = w.ledger.savingsAccounts.find((x) => x.id === l.partId)
    if (p) p.currentBalance += l.amount
    else w.ledger.savingsAccounts.push(part(l.partId, l.amount, { currency: l.currency as never, heldInPaymentMethodId: l.accountId, ...(l.target.kind === 'goal' ? { goalId: l.target.id } : { isMonthlySavings: true }) }))
    w.ledger.savingsTransactions.push(tx(`me-${l.partId}`, l.partId, 'deposit', l.amount, date, { source: 'month_end', currency: l.currency as never, createdAt: `${date}T10:00:00.000Z` }))
  }
}

describe('leftover(C), fixture F', () => {
  it('November: income 75,000, spending 37,000, savedNet 5,000, leftover 33,000', () => {
    expect(figures(fixture())).toEqual({ income: 75000, spending: 37000, savedNet: 5000, unexplainedOut: 0, leftover: 33000 })
  })

  it('T23 gold bought from CIB on Nov 20 for 7,000: savedNet 12,000, leftover 26,000; CIB 93,000, free 59,000', () => {
    const w = fixture()
    w.ledger.savingsAccounts.find((p) => p.id === 'wedding')!.currentBalance += 1.75
    w.ledger.savingsTransactions.push(tx('gold', 'wedding', 'deposit', 2, '2025-11-20', { currency: 'XAU', paymentMethodId: 'CIB', accountAmount: 7000, isCashFlow: true }))
    expect(figures(w)).toMatchObject({ savedNet: 12000, leftover: 26000 })
    expect(free(w, 'CIB', at(11, 30))).toMatchObject({ balance: 93000, free: 59000 })
  })

  it('T30 a negative month: leftover −10,000, nothing proposed', () => {
    const w = fixture()
    w.ledger.expenses.push(expense('more', 43000, 'CIB', '2025-11-26'))
    expect(figures(w)).toMatchObject({ spending: 80000, leftover: -10000 })
    expect(propose(-10000, SPLIT, ctxOf(w, at(12, 1, 9)))).toEqual({ placeable: 0, notPlaced: 0, lines: [] })
  })

  it('T36 a 1,000 refund on a November expense that arrives Dec 5: November unchanged, spending(Dec) −1,000', () => {
    const w = fixture()
    Object.assign(w.ledger.expenses[0], { refundedAmount: 1000, updatedAt: '2025-12-05T10:00:00.000Z' })
    const closed: SummaryWindow[] = [{ ...NOV, createdAt: '2025-12-01T08:00:00.000Z' }]
    expect(figures(w, NOV, closed)).toMatchObject({ spending: 37000, leftover: 33000 })
    expect(figures(w, DEC, closed).spending).toBe(-1000)
  })

  it('T37 an anchor on Nov 28 at 97,000: unexplainedOut 3,000, leftover 30,000, cap(CIB) 63,000', () => {
    const w = fixture()
    w.ledger.adjustments = [{ id: 'a1', paymentMethodId: 'CIB', delta: -3000, anchorBalance: 97000, reason: 'manual_update', occurredAt: new Date(at(11, 28)).toISOString(), createdAt: '2025-11-28T16:00:00.000Z', updatedAt: '2025-11-28T16:00:00.000Z' } as AccountAdjustment]
    expect(figures(w)).toMatchObject({ unexplainedOut: 3000, leftover: 30000 })
    expect(caps(w, at(12, 1, 9)).CIB).toBe(63000)
  })

  it('T46 a late SMS (−1,000 dated Nov 29, arriving Dec 2): November unchanged, spending(Dec) +1,000; CIB 99,000, cap 65,000, placement unchanged', () => {
    const w = fixture()
    const closed: SummaryWindow[] = [{ ...NOV, createdAt: '2025-12-01T08:00:00.000Z' }]
    w.ledger.expenses.push(expense('late', 1000, 'CIB', '2025-11-29', { createdAt: '2025-12-02T09:00:00.000Z' }))
    expect(figures(w, NOV, closed)).toMatchObject({ spending: 37000, leftover: 33000 })
    expect(figures(w, DEC, closed).spending).toBe(1000)
    expect(free(w, 'CIB', at(12, 2)).balance).toBe(99000)
    expect(caps(w, at(12, 2)).CIB).toBe(65000)
    expect(brief(propose(33000, SPLIT, ctxOf(w, at(12, 2))).lines)).toEqual([['car', 'CIB', 16500], ['travel', 'CIB', 6600], ['ms', 'CIB', 9900]])
  })

  it('T47 a closed month keeps its rates: income 75,000 at {USD: 50} even when the live rate is 45', () => {
    const w = fixture()
    expect(figures(w, NOV, [], R50).income).toBe(75000)
    expect(figures(w, NOV, [], { USD: 45 }).income).toBe(73500)
  })
})

describe('propose', () => {
  it('T26 F on Dec 1: caps 66,000 / $800 / 2,000 / 0; Car 16,500, Travel 6,600, MS 9,900, all CIB; after confirm held 61,000, free 33,000, Car 46,500', () => {
    const w = fixture()
    expect(caps(w, at(12, 1, 9))).toEqual({ CIB: 66000, Deel: 800, Cash: 2000, NBE: 0 })
    const p = proposeFor(w)
    expect(p.placeable).toBe(33000)
    expect(p.notPlaced).toBe(0)
    expect(brief(p.lines)).toEqual([['car', 'CIB', 16500], ['travel', 'CIB', 6600], ['ms', 'CIB', 9900]])
    expect(p.lines.every((l) => !l.isNew)).toBe(true)
    applyLabels(w, applyPasses(p.lines, ctxOf(w, at(12, 1, 10))).lines)
    expect(free(w, 'CIB', at(12, 1, 11))).toMatchObject({ balance: 100000, held: 61000, free: 33000 })
    expect(ctxOf(w, at(12, 1, 11)).progress(w.goals[0])).toBe(46500)
  })

  it('T27 fill by cap (F27): Car → Deel $330; Travel → CIB; MS 3,400 → CIB + $130 → Deel; nothing left over', () => {
    const p = proposeFor(fixture({ f27: true }))
    expect(brief(p.lines)).toEqual([['car', 'Deel', 330], ['travel', 'CIB', 6600], ['ms', 'CIB', 3400], ['ms', 'Deel', 130]])
    expect(p.notPlaced).toBe(0)
  })

  it('T28 not enough free (F27, Car Deel $900): placeable 17,000, not placed 16,000; Car 8,500 CIB; Travel 1,500 CIB; MS $100 Deel + 2,000 Cash', () => {
    const w = fixture({ f27: true })
    w.ledger.savingsAccounts.find((x) => x.id === 'carDeel')!.currentBalance = 900
    const p = proposeFor(w)
    expect(p.placeable).toBe(17000)
    expect(p.notPlaced).toBe(16000)
    expect(brief(p.lines)).toEqual([['car', 'CIB', 8500], ['travel', 'CIB', 1500], ['ms', 'Deel', 100], ['ms', 'Cash', 2000]])
    const ms = p.lines.find((l) => l.target.kind === 'ms' && l.accountId === 'Cash')!
    expect(ms.isNew).toBe(true)
  })

  it('T29 a goal near target (Car 40,000): Car 10,000 CIB, completed by apply; MS 16,400; Travel 6,600', () => {
    const w = fixture()
    w.goals[0].targetAmount = 40000
    const p = proposeFor(w)
    expect(brief(p.lines)).toEqual([['car', 'CIB', 10000], ['travel', 'CIB', 6600], ['ms', 'CIB', 16400]])
    expect(completedGoals(p.lines, ctxOf(w, at(12, 1, 10)))).toEqual(['car'])
  })

  it('T31 a salary in days 1–3 (F27, +60,000 Dec 2, auto-apply Dec 4): cap(CIB) stays 10,000; T27 placement', () => {
    const w = fixture({ f27: true })
    w.ledger.incomeEvents.push(income('dec', 60000, 'EGP', 'CIB', '2025-12-02'))
    expect(caps(w, at(12, 1, 9)).CIB).toBe(10000)
    expect(caps(w, at(12, 4)).CIB).toBe(10000)
    expect(free(w, 'CIB', at(12, 4)).free).toBe(70000)
    const p = proposeFor(w)
    expect(brief(applyPasses(p.lines, ctxOf(w, at(12, 4))).lines)).toEqual(brief(proposeFor(fixture({ f27: true })).lines))
  })

  it('T38 a split over 100%: the writer refuses; a stored 110% reads as 45.45 / 18.18 / 36.36', () => {
    const over = [...SPLIT, { target_id: 'wedding', pct: 40 }]
    expect(validateSplit(over)).toEqual({ ok: false, reason: 'over' })
    expect(validateSplit(SPLIT)).toEqual({ ok: true, entries: SPLIT })
    expect(readSplit(over)).toEqual({ over: true, entries: [{ target_id: 'car', pct: 45.45 }, { target_id: 'travel', pct: 18.18 }, { target_id: 'wedding', pct: 36.36 }] })
  })

  it('T40 an achieved target in the split: its share goes to Monthly savings (Travel 6,600, MS 26,400)', () => {
    const w = fixture()
    w.goals[0].status = 'achieved'
    expect(brief(proposeFor(w).lines)).toEqual([['travel', 'CIB', 6600], ['ms', 'CIB', 26400]])
  })

  it('N9 re-proposed after closing Deel with a pending proposal: caps CIB 10,000, Cash 2,000; not placed 21,000; Car 6,000; Travel 2,400; MS 1,600 CIB + 2,000 Cash', () => {
    const w = fixture({ f27: true })
    w.ledger.expenses.push(expense('toCib', 1000, 'Deel', '2025-12-02', { category: 'Transfer', currency: 'USD', toPaymentMethodId: 'CIB', toAccountAmount: 50000 }))
    w.ledger.paymentMethods.find((m) => m.id === 'Deel')!.closedAt = '2025-12-02T12:00:00.000Z'
    w.ledger.savingsAccounts.find((p) => p.id === 'carDeel')!.currentBalance = 0
    w.ledger.savingsAccounts.find((p) => p.id === 'carCIB')!.currentBalance = 30000
    w.ledger.savingsTransactions.push(
      tx('mo', 'carDeel', 'withdrawal', 200, '2025-12-02', { source: 'move_out', currency: 'USD', occurredAt: new Date(at(12, 2, 12)).toISOString() }),
      tx('mi', 'carCIB', 'deposit', 10000, '2025-12-02', { source: 'move_in', occurredAt: new Date(at(12, 2, 12)).toISOString() }),
    )
    expect(caps(w, at(12, 2, 13))).toEqual({ CIB: 10000, Cash: 2000, NBE: 0 })
    const p = proposeFor(w, at(12, 2, 13))
    expect(p.placeable).toBe(12000)
    expect(p.notPlaced).toBe(21000)
    expect(brief(p.lines)).toEqual([['car', 'CIB', 6000], ['travel', 'CIB', 2400], ['ms', 'CIB', 1600], ['ms', 'Cash', 2000]])
  })

  it('N10 the split changes before auto-apply (Car 50% → 30%): Car 9,900, Travel 6,600, MS 16,500, all CIB', () => {
    const p = proposeFor(fixture(), at(12, 2), [{ target_id: 'car', pct: 30 }, { target_id: 'travel', pct: 20 }])
    expect(brief(p.lines)).toEqual([['car', 'CIB', 9900], ['travel', 'CIB', 6600], ['ms', 'CIB', 16500]])
  })
})

describe('apply passes', () => {
  it('T32 a spend in days 1–3 (CIB −60,000 Dec 2): cap 6,000; pass 1 Car 6,000 CIB; pass 2 Car $210 Deel, MS $330 Deel; Cash never reached', () => {
    const w = fixture()
    const proposed = proposeFor(w).lines
    w.ledger.expenses.push(expense('dec2', 60000, 'CIB', '2025-12-02'))
    const ctx = ctxOf(w, at(12, 2, 20))
    expect(ctx.accounts.find((a) => a.id === 'CIB')!.cap).toBe(6000)
    const r = applyPasses(proposed, ctx)
    expect(brief(r.lines)).toEqual([['car', 'CIB', 6000], ['car', 'Deel', 210], ['ms', 'Deel', 330]])
    expect(r.capped.map((c) => [c.target.kind === 'ms' ? 'ms' : c.target.id, c.amountBase])).toEqual([['car', 10500], ['travel', 6600], ['ms', 9900]])
    expect(r.lines.some((l) => l.accountId === 'Cash')).toBe(false)
    expect(r.notPlaced).toBe(0)
  })

  it('T39 a line in an account closed before apply is cut and re-filled; nothing is set aside in it', () => {
    const w = fixture({ f27: true })
    const proposed = proposeFor(w).lines
    w.ledger.paymentMethods.find((m) => m.id === 'Deel')!.closedAt = '2025-12-02T12:00:00.000Z'
    const r = applyPasses(proposed, ctxOf(w, at(12, 3)))
    expect(r.lines.some((l) => l.accountId === 'Deel')).toBe(false)
    expect(r.capped.filter((c) => c.accountId === 'Deel').map((c) => c.amountBase)).toEqual([16500, 6500])
    expect(brief(r.lines)).toEqual([['travel', 'CIB', 6600], ['ms', 'CIB', 3400], ['car', 'Cash', 2000]])
    expect(r.notPlaced).toBe(21000)
  })

  it('N1 the rate moves to 55 before apply: amount_base wins; Car → Deel $300, MS Deel $118.18; CIB lines unchanged', () => {
    const w = fixture({ f27: true })
    const proposed = proposeFor(w).lines
    const r = applyPasses(proposed, ctxOf(w, at(12, 3), { USD: 55 }))
    expect(brief(r.lines)).toEqual([['car', 'Deel', 300], ['travel', 'CIB', 6600], ['ms', 'CIB', 3400], ['ms', 'Deel', 118.18]])
    expect(r.lines.map((l) => l.amountBase)).toEqual([16500, 6600, 3400, 6500])
  })

  it('N2 a refund after apply: CIB 101,000; free(CIB) 33,000 → 34,000; spending(Dec) −1,000', () => {
    const w = fixture()
    applyLabels(w, applyPasses(proposeFor(w).lines, ctxOf(w, at(12, 1, 10))).lines)
    expect(free(w, 'CIB', at(12, 4)).free).toBe(33000)
    Object.assign(w.ledger.expenses[0], { refundedAmount: 1000, updatedAt: '2025-12-05T10:00:00.000Z' })
    expect(free(w, 'CIB', at(12, 5))).toMatchObject({ balance: 101000, free: 34000 })
    expect(figures(w, DEC, [{ ...NOV, createdAt: '2025-12-01T08:00:00.000Z' }]).spending).toBe(-1000)
  })
})

describe('undo', () => {
  const applied = () => {
    const w = fixture()
    const lines = applyPasses(proposeFor(w).lines, ctxOf(w, at(12, 1, 10))).lines
    applyLabels(w, lines)
    return { w, lines }
  }
  const balances = (w: World) => new Map(w.ledger.savingsAccounts.map((p) => [p.id, p.currentBalance]))

  it('T34 undo after a release of MS 5,000: Car −16,500 → 30,000; Travel −6,600 → 5,000; MS −7,900 → 0, "2,000 not undone"', () => {
    const { w, lines } = applied()
    w.ledger.savingsAccounts.find((p) => p.id === 'ms')!.currentBalance -= 5000
    w.ledger.savingsTransactions.push(tx('rel', 'ms', 'withdrawal', 5000, '2025-12-02', { source: 'release', createdAt: '2025-12-02T10:00:00.000Z' }))
    expect(undoBlocked(lines.map((l) => l.partId), '2025-12-01T10:00:00.000Z', w.ledger.savingsTransactions)).toBe(false)
    expect(undoAmounts(lines, balances(w))).toEqual([
      { partId: 'carCIB', withdraw: 16500, notUndone: 0 },
      { partId: 'travel', withdraw: 6600, notUndone: 0 },
      { partId: 'ms', withdraw: 7900, notUndone: 2000 },
    ])
  })

  it('N3 undo is disabled once I spent it touched an applied part (CIB −80,000 Dec 3, spent MS 12,900)', () => {
    const { w, lines } = applied()
    w.ledger.expenses.push(expense('big', 80000, 'CIB', '2025-12-03'))
    expect(computeBalances(w.ledger, at(12, 3)).get('CIB')!.balance - computeBalances(w.ledger, at(12, 3)).get('CIB')!.held).toBe(-41000)
    w.ledger.savingsTransactions.push(tx('sp', 'ms', 'withdrawal', 12900, '2025-12-03', { source: 'spent', createdAt: '2025-12-03T19:00:00.000Z' }))
    expect(undoBlocked(lines.map((l) => l.partId), '2025-12-01T10:00:00.000Z', w.ledger.savingsTransactions)).toBe(true)
  })

  it('N5 a goal completed by the month-end, then undone: Car back to 30,000 and active, achieved_at null; MS and Travel reversed', () => {
    const w = fixture()
    w.goals[0].targetAmount = 40000
    const ctx = ctxOf(w, at(12, 1, 10))
    const lines = applyPasses(proposeFor(w).lines, ctx).lines
    const achieved = completedGoals(lines, ctx)
    expect(achieved).toEqual(['car'])
    applyLabels(w, lines)
    const goals = w.goals.map((g) => (achieved.includes(g.id) ? { ...g, status: 'achieved' as const, achievedAt: '2025-12-01T10:00:00.000Z' } : g))
    const back = undoAmounts(lines, balances(w))
    expect(back.map((b) => [b.partId, b.withdraw])).toEqual([['carCIB', 10000], ['travel', 6600], ['ms', 16400]])
    for (const b of back) w.ledger.savingsAccounts.find((p) => p.id === b.partId)!.currentBalance -= b.withdraw
    const reverted = revertAchievedForMonthEndUndo(goals, achieved)
    expect(reverted[0]).toMatchObject({ status: 'active', achievedAt: null })
    expect(ctxOf(w, at(12, 2)).progress(reverted[0])).toBe(30000)
  })
})

describe('OQ-2 fixed-amount goals', () => {
  it('no automatic line: a note until a % exists; then monthly_contribution is no longer read', async () => {
    const { fixedGoalNotes, withSplitShares } = await import('../fixedGoals')
    const car = { ...fixture().goals[0], fundingMode: 'fixed', monthlyContribution: 2000 } as World['goals'][number]
    expect(fixedGoalNotes([car], []).map((g) => g.id)).toEqual(['car'])
    expect(fixedGoalNotes([car], [], ['car'])).toEqual([])
    const split = [{ target_id: 'car', pct: 10 }]
    expect(fixedGoalNotes([car], split)).toEqual([])
    expect(withSplitShares([car], split)[0]).toMatchObject({ fundingMode: 'share', sharePct: 10, monthlyContribution: null })
    expect(propose(33000, [], ctxOf({ ...fixture(), goals: [car] }, at(12, 1, 9))).lines.every((l) => l.target.kind === 'ms')).toBe(true)
  })
})

describe('apply after a target changed', () => {
  it('a goal achieved between propose and apply: its line is cut and its share goes to Monthly savings', () => {
    const w = fixture()
    const proposed = proposeFor(w).lines
    w.goals[0].status = 'achieved'
    const r = applyPasses(proposed, ctxOf(w, at(12, 2)))
    expect(brief(r.lines)).toEqual([['travel', 'CIB', 6600], ['ms', 'CIB', 26400]])
    expect(r.capped).toEqual([{ target: { kind: 'ms' }, accountId: 'CIB', amountBase: 16500 }])
  })
})

describe('review fixes', () => {
  it('a pocket moved to another account after the proposal: its line goes to Monthly savings', () => {
    const w = fixture()
    const proposed = proposeFor(w).lines
    w.ledger.savingsAccounts.find((p) => p.id === 'travel')!.heldInPaymentMethodId = 'NBE'
    const r = applyPasses(proposed, ctxOf(w, at(12, 2)))
    expect(brief(r.lines)).toEqual([['car', 'CIB', 16500], ['ms', 'CIB', 16500]])
  })

  it('a close label on an applied part also turns Undo off; a release does not (T34)', () => {
    const t = (source: string) => [tx('x', 'ms', 'withdrawal', 1, '2025-12-03', { source, createdAt: '2025-12-03T10:00:00.000Z' })]
    expect(undoBlocked(['ms'], '2025-12-01T10:00:00.000Z', t('close'))).toBe(true)
    expect(undoBlocked(['ms'], '2025-12-01T10:00:00.000Z', t('release'))).toBe(false)
  })

  it('moving a pocket remaps its split entry to the new row', async () => {
    const { remapSplitEntries } = await import('../remapSplit')
    expect(remapSplitEntries(SPLIT, 'travel', 'travel2')).toEqual([{ target_id: 'car', pct: 50 }, { target_id: 'travel2', pct: 20 }])
    expect(remapSplitEntries(SPLIT, 'other', 'x')).toBeNull()
  })
})
