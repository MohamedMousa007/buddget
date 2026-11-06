'use client'

import { countedDebtPayments, countedDebts } from '@/lib/spending/exclusion'
import { useMemo } from 'react'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useShallow } from 'zustand/react/shallow'
import { currentCycle } from '@/lib/settings/payCycle'
import { parseISO, addMonths, differenceInCalendarMonths, isWithinInterval } from 'date-fns'
import { addCalendarWeeks, weeksElapsed } from '@/lib/time/calendarDays'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { debtFamily, type DebtFamily } from '@/lib/debts/debtFamily'
import {
  calculateDebtRemaining,
  totalPaidTowardDebt,
  goldGramsToMoney,
} from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import {
  computeCreditCardOutstanding,
  getCurrentBillingCycleExpenses,
  sumExpensesInDebtCurrency,
  getNextCreditCardDueDate,
  daysUntilDue,
  creditUtilizationRatio,
} from '@/lib/debt/computeCreditCardBalance'
import { cardDue } from '@/lib/debt/cardDue'
import { debtFreeBy, lastPaymentDate, paymentsToClear } from '@/lib/debts/heroStats'
import { paidAsEntered } from '@/lib/debts/paymentAmounts'
import { installmentPaymentsCompleted, nextInstallmentDueDate, nextInstallmentDueFormatted } from '@/lib/debts/installmentSchedule'
import { findProviderBrand } from '@/lib/constants/installmentProviders'
import { decomposePaymentMethodName, providerInitials } from '@/lib/payment/paymentMethodDefaults'
import type { Currency, Debt, DebtGoal, DebtPayment, GoldKarat } from '@/lib/store/types'

/** Family accent colours: theme tokens, so they resolve per light/dark. */
export const FAMILY_ACCENT: Record<DebtFamily, string> = {
  borrow: 'var(--color-cat-1)',
  credit_card: 'var(--color-cat-6)',
  installment: 'var(--color-cat-5)',
}

export interface BorrowVM {
  id: string
  name: string
  avatarInit: string
  /** Counterparty name, shown under the debt name when it differs. */
  person?: string
  relation?: string
  dir: 'owe' | 'owed'
  total: number
  paid: number
  remaining: number
  currency: string
  accent: string
  gold?: { grams: number; karat: GoldKarat }
  goal?: { by: string; per: number; cadence: DebtGoal['paymentFrequency']; remaining: number; next?: string; onTrack: boolean }
}

export interface CreditCardVM {
  id: string
  bank: string
  initials: string
  last4?: string
  color: string
  currency: string
  limit?: number
  outstanding: number
  utilPct: number | null
  overBy: number
  regularDue: number
  installmentDue: number
  allDue: number
  after: number
  due?: string
  daysLeft?: number
}

export interface InstallmentVM {
  id: string
  item: string
  providerName: string
  brandColor: string
  logoSlug?: string
  count: number
  paid: number
  per: number
  remaining: number
  currency: string
  next?: string
  method?: string
  onCardLast4?: string
}

export interface ScheduledPaymentVM {
  debtId: string
  name: string
  date: Date
  /** Amount in the base currency. */
  amount: number
}

export interface PaymentVM {
  id: string
  family: DebtFamily
  name: string
  method?: string
  amount: number
  currency: string
  date: string
}

export interface ClearedVM {
  id: string
  family: DebtFamily
  name: string
  original: number
  currency: string
  clearedMonth: string
  history: { date: string; method?: string; amount: number; currency: string }[]
}

export interface AssignCandidateVM {
  id: string
  amount: number
  currency: string
  method: string
  date: string
  /** An active installment plan whose per-cycle amount matches this payment, if any. */
  debtId?: string
}

function paidInBase(debt: Debt, payments: DebtPayment[], base: Currency, rates: Record<string, number>, gpg: number, goldOk: boolean): number {
  const paid = totalPaidTowardDebt(debt.id, payments)
  if (paid <= 0) return 0
  if (debt.isGold && !goldOk) return 0
  return debt.isGold ? goldGramsToMoney(paid, gpg, debt.goldKarat) : convertCurrency(paid, debt.currency, base, rates)
}

/**
 * All view models the redesigned Debt tab needs, computed once from the store.
 * Keeps the components dumb + data-driven (handoff §10).
 */
export function useDebtTabData() {
  const stats = useMonthlyStats()
  const t = useT()
  const { locale } = useLocale()
  const { debts, debtPayments, paymentMethods, settings, exchangeRates, goldPricePerGram, goldPriceAvailable } = useFinanceStore(
    useShallow((s) => ({
      debts: countedDebts(s.debts, s.paymentMethods),
      debtPayments: countedDebtPayments(s.debtPayments, s.debts, s.paymentMethods),
      paymentMethods: s.paymentMethods,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
      goldPriceAvailable: s.goldPriceAvailable !== false,
    })),
  )
  const expenses = useFinanceStore((s) => s.expenses)
  const recurring = useFinanceStore((s) => s.recurringDebtPayments)
  const base = settings.baseCurrency

  return useMemo(() => {
    const active = debts.filter((d) => d.status !== 'cleared')
    const balanceCtx = { expenses, exchangeRates, allDebts: debts }
    const paymentsFor = (id: string) => debtPayments.filter((p) => p.debtId === id)
    const last4Of = (pmId?: string) => (pmId ? paymentMethods.find((m) => m.id === pmId)?.last4 : undefined)

    // --- portfolio totals ---
    const owed = stats.debtRemainingTotal
    const paidOff = debts.reduce((s, d) => s + paidInBase(d, paymentsFor(d.id), base, exchangeRates, goldPricePerGram, goldPriceAvailable), 0)
    const everBorrowed = owed + paidOff
    const clearedPct = everBorrowed > 0 ? Math.round((paidOff / everBorrowed) * 100) : 0

    const counts = { borrow: 0, credit_card: 0, installment: 0 } as Record<DebtFamily, number>
    for (const d of active) counts[debtFamily(d)] += 1

    // --- installment plans linked to a card (for the card's "all due") ---
    const installmentPerByCard = new Map<string, number>()
    for (const d of active) {
      if (d.debtType === 'installment' && d.linkedCreditCardDebtId && d.installmentAmount) {
        installmentPerByCard.set(d.linkedCreditCardDebtId, (installmentPerByCard.get(d.linkedCreditCardDebtId) ?? 0) + d.installmentAmount)
      }
    }

    // --- borrow cards ---
    const borrow: BorrowVM[] = active
      .filter((d) => debtFamily(d) === 'borrow')
      .map((d) => {
        const pays = paymentsFor(d.id)
        const paid = totalPaidTowardDebt(d.id, pays)
        const remaining = calculateDebtRemaining(d, pays, balanceCtx)
        const g = d.goal
        return {
          id: d.id,
          name: d.name || d.personName || d.person || '—',
          avatarInit: (d.name || d.personName || d.person || '?').trim().charAt(0).toUpperCase(),
          person: d.personName || d.person || undefined,
          relation: d.relationship,
          dir: d.direction === 'they_owe' ? 'owed' : 'owe',
          total: d.startingBalance,
          paid,
          remaining,
          currency: d.currency,
          accent: d.isGold ? 'var(--color-brand-gold)' : d.direction === 'they_owe' ? 'var(--color-brand-green)' : 'var(--color-brand-primary)',
          gold: d.isGold && d.goldKarat ? { grams: remaining, karat: d.goldKarat } : undefined,
          goal: g ? ((): BorrowVM['goal'] => {
            const start = parseISO(d.createdAt)
            const now = new Date()
            const monthsPer = g.paymentFrequency === 'quarterly' ? 3 : g.paymentFrequency === 'annually' ? 12 : 1
            let elapsed: number
            let nextDate: Date
            if (g.paymentFrequency === 'weekly') {
              elapsed = weeksElapsed(now, start)
              nextDate = addCalendarWeeks(start, elapsed + 1)
            } else {
              elapsed = Math.floor(Math.max(0, differenceInCalendarMonths(now, start)) / monthsPer)
              nextDate = addMonths(start, (elapsed + 1) * monthsPer)
            }
            // On track = paid at least what the schedule expects by now (capped at total).
            const expected = Math.min(g.calculatedAmount * elapsed, d.startingBalance)
            return {
              by: formatLocalized(parseISO(g.targetDate), 'MMM yyyy', locale),
              per: g.calculatedAmount,
              cadence: g.paymentFrequency,
              remaining: g.calculatedAmount > 0 ? Math.ceil(remaining / g.calculatedAmount) : 0,
              next: formatLocalized(nextDate, 'MMM d', locale),
              onTrack: paid + 1e-6 >= expected,
            }
          })() : undefined,
        }
      })

    // --- credit cards ---
    const cards: CreditCardVM[] = active
      .filter((d) => d.debtType === 'credit_card')
      .map((d) => {
        const pays = paymentsFor(d.id)
        const outstanding = computeCreditCardOutstanding(d, expenses, pays, exchangeRates)
        const cycle = getCurrentBillingCycleExpenses(d, expenses, exchangeRates)
        const { regularDue, installmentDue, allDue, after } = cardDue({
          outstanding,
          cycleCharges: sumExpensesInDebtCurrency(cycle.expenses, d.currency as Currency, exchangeRates),
          installmentDue: installmentPerByCard.get(d.id) ?? 0,
        })
        const dueIso = getNextCreditCardDueDate(d, new Date())
        const pm = paymentMethods.find((m) => m.id === d.linkedPaymentMethodId)
        // The stored name already carries the `••1234` suffix (composePaymentMethodName),
        // so strip it here — surfaces render the provider + `••last4` exactly once.
        const bank = decomposePaymentMethodName(d.name, pm?.last4 ?? undefined).provider
        return {
          id: d.id,
          bank,
          initials: providerInitials(bank) || 'CC',
          last4: pm?.last4 ?? undefined,
          color: 'var(--color-cat-6)',
          currency: d.currency,
          limit: d.creditLimit,
          outstanding,
          utilPct: creditUtilizationRatio(outstanding, d.creditLimit) != null ? Math.round(creditUtilizationRatio(outstanding, d.creditLimit)! * 100) : null,
          overBy: d.creditLimit != null ? Math.max(0, outstanding - d.creditLimit) : 0,
          regularDue,
          installmentDue,
          allDue,
          after,
          due: dueIso ?? undefined,
          daysLeft: dueIso ? daysUntilDue(dueIso, new Date()) : undefined,
        }
      })

    // --- installment plans ---
    const installments: InstallmentVM[] = active
      .filter((d) => debtFamily(d) === 'installment')
      .map((d) => {
        const pays = paymentsFor(d.id)
        const paid = installmentPaymentsCompleted(d, pays)
        const count = d.installmentCount ?? 0
        const per = d.installmentAmount ?? 0
        const brand = findProviderBrand(
          (d.installmentProviderName ?? '').toLowerCase().replace(/\s+/g, '') || d.installmentProvider,
        )
        const cardLast4 = d.linkedCreditCardDebtId
          ? last4Of(debts.find((x) => x.id === d.linkedCreditCardDebtId)?.linkedPaymentMethodId)
          : undefined
        const lastPay = pays.length ? [...pays].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] : undefined
        const method =
          (d.linkedPaymentMethodId && paymentMethods.find((m) => m.id === d.linkedPaymentMethodId)?.name) ||
          (lastPay?.paymentMethodId && paymentMethods.find((m) => m.id === lastPay.paymentMethodId)?.name) ||
          undefined
        return {
          id: d.id,
          item: d.name,
          providerName: brand?.name ?? d.installmentProviderName ?? t.debts.installmentFallback,
          brandColor: brand?.color ?? 'var(--color-cat-5)',
          logoSlug: brand?.slug,
          count,
          paid,
          per,
          remaining: calculateDebtRemaining(d, pays, balanceCtx),
          currency: d.currency,
          next: nextInstallmentDueFormatted(d, paid, locale) ?? undefined,
          method,
          onCardLast4: cardLast4 ?? undefined,
        }
      })

    // --- payments feed (newest first) ---
    const payments: PaymentVM[] = [...debtPayments]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((p) => {
        const d = debts.find((x) => x.id === p.debtId)
        return {
          id: p.id,
          family: d ? debtFamily(d) : 'borrow',
          name: d?.name || d?.person || '—',
          method: p.paymentMethodId ? paymentMethods.find((m) => m.id === p.paymentMethodId)?.name : undefined,
          ...paidAsEntered(p, d?.currency ?? base),
          date: p.date,
        }
      })

    // --- cleared vault ---
    const cleared: ClearedVM[] = debts
      .filter((d) => d.status === 'cleared')
      .sort((a, b) => new Date(b.clearedAt ?? 0).getTime() - new Date(a.clearedAt ?? 0).getTime())
      .map((d) => ({
        id: d.id,
        family: debtFamily(d),
        name: d.name || d.person || '—',
        original: d.startingBalance,
        currency: d.currency,
        clearedMonth: d.clearedAt ? formatLocalized(parseISO(d.clearedAt), 'MMM yyyy', locale) : '—',
        history: paymentsFor(d.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .map((p) => ({
            date: p.date,
            method: p.paymentMethodId ? paymentMethods.find((m) => m.id === p.paymentMethodId)?.name : undefined,
            ...paidAsEntered(p, d.currency),
          })),
      }))

    // --- assign-payment candidate: an SMS-booked Installment expense not yet tied
    // to a plan (the needsConfirm fallback path). Surface the most recent one.
    const cand = expenses
      .filter((e) => e.category === 'Installment' && !e.linkedDebtId && !e.isDebtPayment)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    const assignCandidate: AssignCandidateVM | null = cand
      ? {
          id: cand.id,
          amount: cand.amount,
          currency: cand.currency,
          method: (cand.paymentMethodId && paymentMethods.find((m) => m.id === cand.paymentMethodId)?.name) || t.debts.paymentFallback,
          date: formatLocalized(parseISO(cand.date), 'MMM d', locale),
          debtId: (() => {
            const matches = active.filter(
              (d) => debtFamily(d) === 'installment' && d.currency === cand.currency && Math.abs((d.installmentAmount ?? 0) - cand.amount) < 0.5,
            )
            return matches.length === 1 ? matches[0].id : undefined // ambiguous: let the user choose
          })(),
        }
      : null

    // --- hero stats: one scheduled payment per debt (recurring plan > installment cycle > payoff goal) ---
    const now = new Date()
    const nameOf = (d: Debt) => d.name || d.personName || d.person || '—'
    const toBase = (amount: number, currency: string) => convertCurrency(amount, currency, base, exchangeRates)
    const scheduled: ScheduledPaymentVM[] = []
    const projectedEnds: (Date | null)[] = []
    for (const d of active) {
      const plan = recurring.find((r) => r.debtId === d.id && r.isActive)
      const trackEnd = debtFamily(d) !== 'credit_card'
      if (plan) {
        if (trackEnd) {
          const left = d.isGold ? 0 : toBase(calculateDebtRemaining(d, paymentsFor(d.id), balanceCtx), d.currency)
          const periods = paymentsToClear(left, toBase(plan.amount, plan.currency))
          const end = lastPaymentDate(parseISO(plan.nextDueDate), plan.frequency, periods)
          projectedEnds.push(end ?? (d.goal ? parseISO(d.goal.targetDate) : null))
        }
        scheduled.push({ debtId: d.id, name: nameOf(d), date: parseISO(plan.nextDueDate), amount: toBase(plan.amount, plan.currency) })
        continue
      }
      if (d.debtType === 'installment') {
        const next = nextInstallmentDueDate(d, installmentPaymentsCompleted(d, paymentsFor(d.id)))
        if (next && d.installmentAmount) {
          scheduled.push({ debtId: d.id, name: nameOf(d), date: next, amount: toBase(d.installmentAmount, d.currency) })
          const left = (d.installmentCount ?? 0) - installmentPaymentsCompleted(d, paymentsFor(d.id))
          projectedEnds.push(lastPaymentDate(next, d.installmentFrequency ?? 'monthly', left))
        } else projectedEnds.push(null)
        continue
      }
      const g = d.goal
      if (trackEnd) projectedEnds.push(g ? parseISO(g.targetDate) : null)
      if (g && debtFamily(d) === 'borrow' && !d.isGold && g.calculatedAmount > 0) {
        const start = parseISO(d.createdAt)
        const monthsPer = g.paymentFrequency === 'quarterly' ? 3 : g.paymentFrequency === 'annually' ? 12 : 1
        const date =
          g.paymentFrequency === 'weekly'
            ? addCalendarWeeks(start, weeksElapsed(now, start) + 1)
            : addMonths(start, (Math.floor(Math.max(0, differenceInCalendarMonths(now, start)) / monthsPer) + 1) * monthsPer)
        scheduled.push({ debtId: d.id, name: nameOf(d), date, amount: toBase(g.calculatedAmount, d.currency) })
      }
    }
    const { date: debtFreeDate, unplanned: unplannedCount } = debtFreeBy(projectedEnds)
    const lastClearedAt = debts.reduce<Date | null>((best, d) => {
      if (d.status !== 'cleared' || !d.clearedAt) return best
      const at = parseISO(d.clearedAt)
      return !best || at > best ? at : best
    }, null)
    scheduled.sort((a, b) => a.date.getTime() - b.date.getTime())
    const nextPayment = scheduled[0] ?? null
    const cycle = currentCycle(now, settings.monthStartDay)
    const dueList = scheduled.filter((p) => p.date <= cycle.end)
    const dueThisMonth = dueList.reduce((sum, p) => sum + p.amount, 0)
    const paidThisMonth = debtPayments
      .filter((p) => isWithinInterval(parseISO(p.date), { start: cycle.start, end: cycle.end }))
      .reduce((sum, p) => {
        const d = debts.find((x) => x.id === p.debtId)
        if (d?.isGold && (p.originalAmount == null || p.paymentCurrency === 'XAU')) return goldPriceAvailable ? sum + goldGramsToMoney(p.amountPaid, goldPricePerGram, d.goldKarat) : sum
        const paid = paidAsEntered(p, d?.currency ?? base)
        return sum + toBase(paid.amount, paid.currency)
      }, 0)

    return {
      nextPayment,
      dueThisMonth,
      debtFreeDate,
      unplannedCount,
      lastClearedAt,
      paidThisMonth,
      owed,
      paidOff,
      borrowedTotal: everBorrowed,
      clearedPct,
      counts,
      borrow,
      cards,
      installments,
      payments,
      cleared,
      assignCandidate,
      base,
    }
  }, [debts, debtPayments, recurring, paymentMethods, expenses, base, exchangeRates, goldPricePerGram, goldPriceAvailable, settings.monthStartDay, stats.debtRemainingTotal, t, locale])
}
