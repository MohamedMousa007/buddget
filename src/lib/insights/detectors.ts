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

export const MIN_WEEKS = 8
export const MIN_PATTERN_PURCHASES = 60
export const MIN_PAYDAYS = 3
export const MIN_PRIOR_SAME_CATEGORY = 6
export const MIN_CARD_CASH = 15

/** One category running well above or below its own usual, projected to the full cycle. The biggest shift only. */
export function categoryShiftInsight(i: InsightInput): Insight | null {
  if (!enoughThisCycle(i)) return null
  let best: { name: string; pct: number; delta: number } | null = null
  for (const c of i.categories) {
    if (c.usual === null || c.usual <= 0) continue
    const projected = (c.thisCycle / i.cycle.daysElapsed) * i.cycle.totalDays
    const delta = projected - c.usual
    const rel = delta / c.usual
    if (Math.abs(rel) < 0.3 || Math.abs(delta) < (i.usualSpend ?? i.spent) * 0.03) continue
    if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { name: c.name, pct: Math.round(Math.abs(rel) * 100), delta }
  }
  return best ? { kind: 'categoryShift', area: 'spending', score: 75, params: { name: best.name, pct: best.pct, up: best.delta > 0 ? 1 : 0 } } : null
}

export function paydayRhythmInsight(i: InsightInput): Insight | null {
  const p = i.paydays
  if (p.count < MIN_PAYDAYS || p.purchases < MIN_PATTERN_PURCHASES || p.liftPct === null || p.liftPct < 25) return null
  return { kind: 'paydayRhythm', area: 'spending', pro: true, score: 88, params: { pct: Math.round(p.liftPct) } }
}

export function weekdayInsight(i: InsightInput): Insight | null {
  const w = i.weekday
  if (w.weeks < MIN_WEEKS || w.purchases < MIN_PATTERN_PURCHASES || w.overallDaily <= 0) return null
  let day = 0
  for (let d = 1; d < 7; d++) if (w.byDay[d] > w.byDay[day]) day = d
  if (w.byDay[day] < w.overallDaily * 1.4) return null
  return { kind: 'weekdayPattern', area: 'spending', pro: true, score: 50, params: { day, avg: Math.round(w.byDay[day]) } }
}

/** One purchase far above what the user usually spends in that category. Says "one purchase", never "you overspent". */
export function unusualInsight(i: InsightInput): Insight | null {
  const u = i.unusual
  if (!u || u.priorCount < MIN_PRIOR_SAME_CATEGORY || u.typical <= 0 || u.amount < u.typical * 3 || u.amount < i.spent * 0.03) return null
  return { kind: 'unusualPurchase', area: 'spending', pro: true, score: 78, params: { description: u.description, category: u.category, amount: Math.round(u.amount), typical: Math.round(u.typical) } }
}

export function smallBuysInsight(i: InsightInput): Insight | null {
  const s = i.small
  if (s.threshold <= 0 || s.count < 8 || s.total <= 0) return null
  return { kind: 'smallBuys', area: 'spending', pro: true, score: 45, params: { threshold: s.threshold, count: s.count, total: Math.round(s.total) } }
}

export function cashVsCardInsight(i: InsightInput): Insight | null {
  const c = i.cardCash
  if (c.cardN < MIN_CARD_CASH || c.cashN < MIN_CARD_CASH || c.cardAvg <= 0 || c.cashAvg <= 0) return null
  const ratio = c.cardAvg / c.cashAvg
  if (ratio < 1.5 && ratio > 1 / 1.5) return null
  const times = ratio >= 1 ? ratio : 1 / ratio
  return { kind: 'cashVsCard', area: 'how', pro: true, score: 42, params: { times: Math.round(times * 10) / 10, cardBigger: ratio >= 1 ? 1 : 0 } }
}

export function priceRiseInsight(i: InsightInput): Insight | null {
  const r = i.priceRise
  if (!r || r.rise <= 0) return null
  return { kind: 'priceRise', area: 'bills', pro: true, score: 65, params: { name: r.name, rise: Math.round(r.rise) } }
}

export function netWorthPathInsight(i: InsightInput): Insight | null {
  const n = i.netWorthPath
  if (!n || n.projected <= 0) return null
  return { kind: 'netWorthPath', area: 'wealth', pro: true, score: 58, params: { projected: Math.round(n.projected), low: Math.round(Math.max(0, n.low)), high: Math.round(n.high), months: n.months } }
}

export const DETECTORS = [
  paceInsight, topCategoryInsight, keptInsight, bnplInsight, subsInsight, billsInsight, payMixInsight,
  categoryShiftInsight, paydayRhythmInsight, weekdayInsight, unusualInsight, smallBuysInsight, cashVsCardInsight, priceRiseInsight, netWorthPathInsight,
]
