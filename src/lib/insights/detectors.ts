import type { Insight, InsightHero, InsightInput } from './types'

/** Minimum data before anything is said: a wrong finding costs more trust than a missing one. */
export const MIN_DAYS = 5
export const MIN_EXPENSES = 8
export const MIN_PLACED_PURCHASES = 15

const pct = (part: number, whole: number) => Math.round((part / whole) * 100)
const enoughThisCycle = (i: InsightInput) => i.cycle.daysElapsed >= MIN_DAYS && i.expenseCount >= MIN_EXPENSES

export function heroAnswer(i: InsightInput): InsightHero {
  const { daysElapsed, daysLeft } = i.cycle
  const perDay = daysLeft > 0 && i.leftToSpend > 0 ? i.leftToSpend / daysLeft : 0
  if (!enoughThisCycle(i)) return { state: 'learning', perDay, runOutInDays: null, daysLeft, daysMore: Math.max(0, MIN_DAYS - daysElapsed) }
  const lasts = i.dailyRate > 0 && i.leftToSpend > 0 ? Math.floor(i.leftToSpend / i.dailyRate) : i.leftToSpend > 0 ? null : 0
  const runOutInDays = lasts !== null && lasts < daysLeft ? lasts : null
  return { state: runOutInDays === null ? 'ok' : 'tight', perDay, runOutInDays, daysLeft, daysMore: 0 }
}

/** Where this cycle is heading against the user's own usual, never against other people. */
export function paceInsight(i: InsightInput): Insight | null {
  if (!enoughThisCycle(i) || i.usualSpend === null || i.usualSpend <= 0) return null
  const delta = i.projectedSpend - i.usualSpend
  if (Math.abs(delta) < i.usualSpend * 0.05) return null
  return { kind: 'pace', area: 'spending', score: 90 + Math.min(10, Math.abs(delta) / i.usualSpend * 10), params: { delta: Math.round(Math.abs(delta)), more: delta > 0 ? 1 : 0 } }
}

export function topCategoryInsight(i: InsightInput): Insight | null {
  const c = i.topCategory
  if (!enoughThisCycle(i) || !c || c.total <= 0 || c.amount <= 0) return null
  return { kind: 'topCategory', area: 'spending', score: 60, params: { name: c.name, amount: Math.round(c.amount), share: pct(c.amount, c.total) } }
}

/** What stayed after the last closed cycle, from money received (not expected). */
export function keptInsight(i: InsightInput): Insight | null {
  const k = i.keptLast
  if (!k || k.received <= 0) return null
  const kept = k.received - k.spent
  return { kind: 'kept', area: 'income', score: 70, params: { kept: Math.round(Math.abs(kept)), positive: kept >= 0 ? 1 : 0, share: pct(Math.abs(kept), k.received) } }
}

export function bnplInsight(i: InsightInput): Insight | null {
  const b = i.bnpl
  if (b.plans < 2 || b.remaining <= 0) return null
  return { kind: 'bnplBurden', area: 'debts', score: 80, params: { plans: b.plans, remaining: Math.round(b.remaining), monthly: Math.round(b.monthly), share: b.incomeMonthly > 0 ? pct(b.monthly, b.incomeMonthly) : 0 } }
}

export function subsInsight(i: InsightInput): Insight | null {
  if (i.subs.count < 2 || i.subs.monthly <= 0) return null
  return { kind: 'subsTotal', area: 'bills', score: 55, params: { count: i.subs.count, monthly: Math.round(i.subs.monthly) } }
}

export function billsInsight(i: InsightInput): Insight | null {
  if (i.bills.count < 1 || i.bills.total <= 0) return null
  return { kind: 'billsBeforePayday', area: 'bills', score: 85, params: { count: i.bills.count, total: Math.round(i.bills.total), days: i.cycle.daysLeft } }
}

/** Card, cash and unassigned shares. Bank texts with no matched account are "unassigned", never cash. */
export function payMixInsight(i: InsightInput): Insight | null {
  const p = i.pay
  const total = p.card + p.cash + p.unassigned + p.other
  if (p.placedCount < MIN_PLACED_PURCHASES || total <= 0) return null
  return { kind: 'payMix', area: 'how', score: 40, params: { card: pct(p.card, total), cash: pct(p.cash, total), unassigned: pct(p.unassigned, total) } }
}

export const DETECTORS = [paceInsight, topCategoryInsight, keptInsight, bnplInsight, subsInsight, billsInsight, payMixInsight]
