import { differenceInCalendarDays } from 'date-fns'
import { getMonthRange } from '@/lib/utils/calculations'
import { computeMonthlyStats } from '@/lib/utils/monthlyStats'
import { fin, ui } from '@/lib/buddgy/tools/stores'
import type { BuddgyMemory } from '@/lib/store/types'
import { format } from 'date-fns'

export interface ContextInput {
  now: Date
  firstName: string
  language: 'en' | 'ar'
  baseCurrency: string
  secondaryCurrency: string | null
  cycleStart: string
  cycleEnd: string
  cycleDay: number
  cycleLength: number
  income: number
  spent: number
  leftToSpend: number
  safeDaily: number
  pace: string
  route: string
  sheet: string | null
  counts: { debts: number; subscriptions: number; goals: number; paymentMethods: number }
  memories: string[]
}

const r0 = (n: number) => Math.round(n)

export function renderContext(i: ContextInput): string {
  const lines = [
    `${format(i.now, 'yyyy-MM-dd EEE HH:mm')} · cycle ${i.cycleStart}→${i.cycleEnd} (day ${i.cycleDay}/${i.cycleLength})`,
    `user ${i.firstName || '—'} · lang ${i.language} · base ${i.baseCurrency}${i.secondaryCurrency ? ` · also ${i.secondaryCurrency}` : ''}`,
    `month: income ${r0(i.income)} · spent ${r0(i.spent)} · left ${r0(i.leftToSpend)}${i.safeDaily > 0 ? ` · safe/day ${r0(i.safeDaily)}` : ''} · pace ${i.pace}`,
    `on ${i.route}${i.sheet ? ` · sheet ${i.sheet}` : ''}`,
    `has ${i.counts.debts} debts · ${i.counts.subscriptions} subs · ${i.counts.goals} goals · ${i.counts.paymentMethods} methods`,
  ]
  if (i.memories.length > 0) lines.push(`remembered: ${i.memories.join(' | ')}`)
  return lines.join('\n')
}

const tokens = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2)

/** At most five facts: all of them when few, otherwise the ones that share words with what was asked. */
export function relevantMemories(memories: BuddgyMemory[], text: string, max = 5): string[] {
  const active = memories.filter((m) => m.status === 'active')
  if (active.length <= max) return active.map((m) => m.text)
  const asked = new Set(tokens(text))
  return active
    .map((m) => ({ m, score: tokens(m.text).filter((t) => asked.has(t)).length }))
    .sort((a, b) => b.score - a.score || b.m.updatedAt.localeCompare(a.m.updatedAt))
    .slice(0, max)
    .map((x) => x.m.text)
}

export function readContextInput(args: { now: Date; route: string; text: string }): ContextInput {
  const s = fin()
  const monthFilter = ui().monthFilter
  const st = computeMonthlyStats({
    expenses: s.expenses,
    incomeSources: s.incomeSources,
    incomeEvents: s.incomeEvents,
    budgetCategories: s.budgetCategories,
    budgetPlans: s.budgetPlans,
    budgetPlanActivations: s.budgetPlanActivations,
    activeBudgetPlanId: s.activeBudgetPlanId,
    savingsHoldings: s.savingsHoldings,
    savingsAccounts: s.savingsAccounts,
    savingsTransactions: s.savingsTransactions,
    debts: s.debts,
    debtPayments: s.debtPayments,
    settings: s.settings,
    exchangeRates: s.exchangeRates,
    goldPricePerGram: s.goldPricePerGram,
    goldPriceAvailable: s.goldPriceAvailable,
    monthFilter,
    trustLocalFinance: true,
  })
  const range = getMonthRange(monthFilter, s.settings.monthStartDay)
  const total = differenceInCalendarDays(range.end, range.start) + 1
  return {
    now: args.now,
    firstName: s.profile.name?.trim().split(/\s+/)[0] ?? '',
    language: s.settings.language === 'ar' ? 'ar' : 'en',
    baseCurrency: s.settings.baseCurrency,
    secondaryCurrency: s.settings.showSecondaryCurrency ? s.settings.secondaryCurrency : null,
    cycleStart: format(range.start, 'yyyy-MM-dd'),
    cycleEnd: format(range.end, 'yyyy-MM-dd'),
    cycleDay: Math.min(total, st.daysElapsed),
    cycleLength: total,
    income: st.totalIncome,
    spent: st.totalSpentExcludingSavings,
    leftToSpend: st.leftToSpend,
    safeDaily: st.suggestedDaily,
    pace: st.paceStatus,
    route: args.route,
    sheet: ui().activeModal,
    counts: {
      debts: s.debts.filter((d) => d.status !== 'cleared').length,
      subscriptions: s.subscriptions.filter((x) => x.status === 'active' || x.status === 'trial').length,
      goals: s.goals.length,
      paymentMethods: s.paymentMethods.length,
    },
    memories: relevantMemories(s.buddgyMemories, args.text),
  }
}

export function buildContext(args: { now: Date; route: string; text: string }): string {
  return renderContext(readContextInput(args))
}
