'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { format, parseISO, addMonths, addWeeks, differenceInCalendarMonths, differenceInCalendarWeeks } from 'date-fns'
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
import { installmentPaymentsCompleted, nextInstallmentDueFormatted } from '@/lib/debts/installmentSchedule'
import { findProviderBrand } from '@/lib/constants/installmentProviders'
import type { Currency, Debt, DebtPayment, GoldKarat } from '@/lib/store/types'

/** Family accent colors (handoff §1). */
export const FAMILY_ACCENT: Record<DebtFamily, string> = {
  borrow: '#E50914',
  credit_card: '#8A5CF6',
  installment: '#00C2A8',
}

export interface BorrowVM {
  id: string
  name: string
  avatarInit: string
  relation?: string
  dir: 'owe' | 'owed'
  total: number
  paid: number
  remaining: number
  currency: string
  accent: string
  gold?: { grams: number; karat: GoldKarat }
  goal?: { by: string; per: number; cadence: string; remaining: number; next?: string; onTrack: boolean }
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
}

function paidInBase(debt: Debt, payments: DebtPayment[], base: Currency, rates: Record<string, number>, gpg: number): number {
  const paid = totalPaidTowardDebt(debt.id, payments)
  if (paid <= 0) return 0
  return debt.isGold ? goldGramsToMoney(paid, gpg, debt.goldKarat) : convertCurrency(paid, debt.currency, base, rates)
}

/**
 * All view models the redesigned Debt tab needs, computed once from the store.
 * Keeps the components dumb + data-driven (handoff §10).
 */
export function useDebtTabData() {
  const stats = useMonthlyStats()
  const { debts, debtPayments, paymentMethods, settings, exchangeRates, goldPricePerGram } = useFinanceStore(
    useShallow((s) => ({
      debts: s.debts,
      debtPayments: s.debtPayments,
      paymentMethods: s.paymentMethods,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
    })),
  )
  const expenses = useFinanceStore((s) => s.expenses)
  const base = settings.baseCurrency

  return useMemo(() => {
    const active = debts.filter((d) => d.status !== 'cleared')
    const balanceCtx = { expenses, exchangeRates, allDebts: debts }
    const paymentsFor = (id: string) => debtPayments.filter((p) => p.debtId === id)
    const last4Of = (pmId?: string) => (pmId ? paymentMethods.find((m) => m.id === pmId)?.last4 : undefined)

    // --- portfolio totals ---
    const owed = stats.debtRemainingTotal
    const paidOff = debts.reduce((s, d) => s + paidInBase(d, paymentsFor(d.id), base, exchangeRates, goldPricePerGram), 0)
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
          relation: d.relationship,
          dir: d.direction === 'they_owe' ? 'owed' : 'owe',
          total: d.startingBalance,
          paid,
          remaining,
          currency: d.currency,
          accent: d.isGold ? '#F5C842' : d.direction === 'they_owe' ? '#1DB954' : '#E50914',
          gold: d.isGold && d.goldKarat ? { grams: remaining, karat: d.goldKarat } : undefined,
          goal: g ? ((): BorrowVM['goal'] => {
            const start = parseISO(d.createdAt)
            const now = new Date()
            const monthsPer = g.paymentFrequency === 'quarterly' ? 3 : g.paymentFrequency === 'annually' ? 12 : 1
            let elapsed: number
            let nextDate: Date
            if (g.paymentFrequency === 'weekly') {
              elapsed = Math.max(0, differenceInCalendarWeeks(now, start))
              nextDate = addWeeks(start, elapsed + 1)
            } else {
              elapsed = Math.floor(Math.max(0, differenceInCalendarMonths(now, start)) / monthsPer)
              nextDate = addMonths(start, (elapsed + 1) * monthsPer)
            }
            // On track = paid at least what the schedule expects by now (capped at total).
            const expected = Math.min(g.calculatedAmount * elapsed, d.startingBalance)
            return {
              by: format(parseISO(g.targetDate), 'MMM'),
              per: g.calculatedAmount,
              cadence: g.paymentFrequency,
              remaining: g.calculatedAmount > 0 ? Math.ceil(remaining / g.calculatedAmount) : 0,
              next: format(nextDate, 'MMM d'),
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
        const regularDue = sumExpensesInDebtCurrency(cycle.expenses, d.currency as Currency, exchangeRates)
        const installmentDue = installmentPerByCard.get(d.id) ?? 0
        const allDue = regularDue + installmentDue
        const dueIso = getNextCreditCardDueDate(d, new Date())
        const pm = paymentMethods.find((m) => m.id === d.linkedPaymentMethodId)
        return {
          id: d.id,
          bank: d.name,
          initials: d.name.replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'CC',
          last4: pm?.last4 ?? undefined,
          color: '#8A5CF6',
          currency: d.currency,
          limit: d.creditLimit,
          outstanding,
          utilPct: creditUtilizationRatio(outstanding, d.creditLimit) != null ? Math.round(creditUtilizationRatio(outstanding, d.creditLimit)! * 100) : null,
          overBy: d.creditLimit != null ? Math.max(0, outstanding - d.creditLimit) : 0,
          regularDue,
          installmentDue,
          allDue,
          after: Math.max(0, outstanding - allDue),
          due: dueIso ?? undefined,
          daysLeft: dueIso ? daysUntilDue(dueIso, new Date()) : undefined,
        }
      })

    // --- installment plans ---
    const installments: InstallmentVM[] = active
      .filter((d) => debtFamily(d) === 'installment')
      .map((d) => {
        const pays = paymentsFor(d.id)
        const paid = installmentPaymentsCompleted(d, pays.length)
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
          providerName: brand?.name ?? d.installmentProviderName ?? 'Installment',
          brandColor: brand?.color ?? '#00C2A8',
          logoSlug: brand?.slug,
          count,
          paid,
          per,
          remaining: Math.max(0, (count - paid) * per),
          currency: d.currency,
          next: nextInstallmentDueFormatted(d, paid) ?? undefined,
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
          amount: p.amountPaid,
          currency: p.paymentCurrency ?? d?.currency ?? base,
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
        clearedMonth: d.clearedAt ? format(parseISO(d.clearedAt), 'MMM yyyy') : '—',
        history: paymentsFor(d.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .map((p) => ({
            date: p.date,
            method: p.paymentMethodId ? paymentMethods.find((m) => m.id === p.paymentMethodId)?.name : undefined,
            amount: p.amountPaid,
            currency: p.paymentCurrency ?? d.currency,
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
          method: (cand.paymentMethodId && paymentMethods.find((m) => m.id === cand.paymentMethodId)?.name) || 'Payment',
          date: format(parseISO(cand.date), 'MMM d'),
        }
      : null

    return {
      owed,
      paidOff,
      everBorrowed,
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
  }, [debts, debtPayments, paymentMethods, expenses, base, exchangeRates, goldPricePerGram, stats.debtRemainingTotal])
}
