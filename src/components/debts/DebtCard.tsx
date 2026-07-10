'use client'

import { motion } from 'framer-motion'
import { Check, Pencil } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatCurrency } from '@/lib/utils/formatters'
import {
  calculateDebtRemaining,
  goldGramsToMoney,
  isDebtFullyPaid,
  type DebtBalanceContext,
} from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { MoneyDisplay } from '@/components/ui/MoneyDisplay'
import type { Debt, DebtPayment } from '@/lib/store/types'
import { useT } from '@/lib/i18n'
import { DebtCardPlanMeta } from '@/components/debts/DebtCardPlanMeta'

interface DebtCardProps {
  debt: Debt
  payments: DebtPayment[]
  onRecordPayment: () => void
  onEdit: () => void
  /** Installment plans: the active reminder's next due date (ISO) — shown + drives the CTA. */
  nextInstallmentDue?: string
  /** Installment plans with an active reminder: one-tap "pay next installment". */
  onPayInstallment?: () => void
}

export function DebtCard({ debt, payments, onRecordPayment, onEdit, nextInstallmentDue, onPayInstallment }: DebtCardProps) {
  const t = useT()
  const clearDebt = useFinanceStore((s) => s.clearDebt)
  const { settings, exchangeRates, goldPricePerGram, goldPriceAvailable, expenses, debts } =
    useFinanceStore(
      useShallow((s) => ({
        settings: s.settings,
        exchangeRates: s.exchangeRates,
        goldPricePerGram: s.goldPricePerGram,
        goldPriceAvailable: s.goldPriceAvailable,
        expenses: s.expenses,
        debts: s.debts,
      }))
    )
  const base = settings.baseCurrency

  const balanceCtx: DebtBalanceContext | undefined = useMemo(
    () => ({ expenses, exchangeRates, allDebts: debts }),
    [expenses, exchangeRates, debts]
  )

  const [celebrating, setCelebrating] = useState(false)
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPaidOff = useRef<boolean | null>(null)

  const paidOff = isDebtFullyPaid(debt, payments, balanceCtx)
  const remainingRaw = calculateDebtRemaining(debt, payments, balanceCtx)

  const goldOk = goldPriceAvailable !== false
  const startingInBase = debt.isGold
    ? goldOk
      ? goldGramsToMoney(debt.startingBalance, goldPricePerGram, debt.goldKarat)
      : null
    : convertCurrency(debt.startingBalance, debt.currency, base, exchangeRates)

  const remainingInBase = debt.isGold
    ? goldOk
      ? goldGramsToMoney(remainingRaw, goldPricePerGram, debt.goldKarat)
      : null
    : convertCurrency(remainingRaw, debt.currency, base, exchangeRates)

  const paidPercent =
    debt.debtType === 'credit_card' && debt.creditLimit && debt.creditLimit > 0
      ? Math.min(100, (remainingRaw / debt.creditLimit) * 100)
      : debt.startingBalance > 0
        ? ((debt.startingBalance - remainingRaw) / debt.startingBalance) * 100
        : 0

  useEffect(() => {
    if (debt.debtType === 'credit_card') {
      prevPaidOff.current = paidOff
      return
    }
    if (debt.status === 'cleared') {
      prevPaidOff.current = paidOff
      return
    }
    if (prevPaidOff.current === null) {
      prevPaidOff.current = paidOff
      if (paidOff) {
        clearDebt(debt.id)
      }
      return
    }
    if (!paidOff) {
      prevPaidOff.current = false
      return
    }
    if (prevPaidOff.current === false && paidOff) {
      queueMicrotask(() => {
        setCelebrating(true)
      })
      celebrateTimer.current = setTimeout(() => {
        clearDebt(debt.id)
        setCelebrating(false)
        celebrateTimer.current = null
      }, 3000)
      prevPaidOff.current = true
      return () => {
        if (celebrateTimer.current) {
          clearTimeout(celebrateTimer.current)
          celebrateTimer.current = null
        }
      }
    }
    prevPaidOff.current = paidOff
    return undefined
  }, [paidOff, debt.status, debt.id, debt.debtType, clearDebt])

  const dismissCelebration = () => {
    if (celebrateTimer.current) {
      clearTimeout(celebrateTimer.current)
      celebrateTimer.current = null
    }
    clearDebt(debt.id)
    setCelebrating(false)
  }

  return (
    <div
      className={`glass-card rounded-2xl p-6 relative overflow-hidden transition-shadow ${
        celebrating ? 'ring-2 ring-[var(--color-brand-green)] shadow-[0_0_24px_rgba(29,185,84,0.25)]' : ''
      }`}
    >
      {celebrating ? (
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-[var(--color-brand-card)]/95 backdrop-blur-sm px-4"
          onClick={dismissCelebration}
          aria-label={t.common.close}
        >
          <motion.div
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="w-14 h-14 rounded-full bg-[var(--color-brand-green)]/20 flex items-center justify-center"
          >
            <Check className="w-8 h-8 text-[var(--color-brand-green)]" strokeWidth={3} />
          </motion.div>
          <p className="text-lg font-semibold text-[var(--color-brand-text-primary)] text-center">{t.debts.celebrationTitle}</p>
          <p className="text-xs text-[var(--color-brand-text-muted)]">{t.debts.celebrationTapHint}</p>
        </motion.button>
      ) : null}

      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl mt-0.5">{debt.isGold ? '🪙' : '💵'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-[var(--color-brand-text-primary)] uppercase">{debt.name}</h3>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                debt.isGold
                  ? 'bg-[var(--color-brand-gold)]/20 text-[var(--color-brand-gold)]'
                  : 'bg-[var(--color-brand-green)]/20 text-[var(--color-brand-green)]'
              }`}
            >
              {debt.isGold ? `Gold ${debt.goldKarat || 24}K` : t.dashboard.debtBadgeCash}
            </span>
            {paidOff ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 bg-[var(--color-brand-green)]/25 text-[var(--color-brand-green)]">
                {t.debts.statusCleared}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">
            {t.debts.owedTo}
            {debt.person}
          </p>
          {debt.description && (
            <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5 italic">
              {debt.description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center justify-center min-w-11 min-h-11 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors shrink-0"
          aria-label={t.common.edit}
        >
          <Pencil className="w-3.5 h-3.5 text-[var(--color-brand-text-muted)]" aria-hidden />
        </button>
      </div>

      <DebtCardPlanMeta debt={debt} payments={payments} paidOff={paidOff} balanceCtx={balanceCtx} nextDueOverride={nextInstallmentDue} />

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-brand-text-secondary)]">{t.debts.labelStartedAt}</span>
          <div className="text-right">
            {debt.isGold && !goldOk ? (
              <div>
                <span className="font-mono-numbers text-[var(--color-brand-text-primary)]">
                  {formatCurrency(debt.startingBalance, 'XAU')}
                </span>
                <p className="text-[10px] text-[var(--color-brand-text-muted)] italic mt-0.5">
                  {t.savings.goldAedUnavailable}
                </p>
              </div>
            ) : (
              <>
                <MoneyDisplay
                  amount={debt.startingBalance}
                  currency={debt.isGold ? 'XAU' : debt.currency}
                  amountInPrimary={startingInBase ?? undefined}
                  variant="card"
                  primaryClassName="text-[var(--color-brand-text-primary)]"
                />
                {debt.isGold ? (
                  <span className="text-xs text-[var(--color-brand-text-muted)] ms-1.5">
                    ({debt.startingBalance}g)
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-brand-text-secondary)]">{t.debts.labelStillToGo}</span>
          <div className="text-right">
            {debt.isGold && !goldOk ? (
              <div>
                <span className="font-mono-numbers text-[var(--color-brand-text-primary)] font-semibold">
                  {formatCurrency(remainingRaw, 'XAU')}
                </span>
                <p className="text-[10px] text-[var(--color-brand-text-muted)] italic mt-0.5">
                  {t.savings.goldAedUnavailable}
                </p>
              </div>
            ) : (
              <>
                <MoneyDisplay
                  amount={remainingRaw}
                  currency={debt.isGold ? 'XAU' : debt.currency}
                  amountInPrimary={remainingInBase ?? undefined}
                  variant="card"
                  primaryClassName="text-[var(--color-brand-text-primary)] font-semibold"
                />
                {debt.isGold ? (
                  <span className="text-xs text-[var(--color-brand-text-muted)] ms-1.5">
                    ({remainingRaw.toFixed(1)}g)
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="h-2 bg-[var(--color-brand-border)] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[var(--color-brand-red)]"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(paidPercent, 100)}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>

        <div className="flex justify-between items-center">
          <p className="text-xs text-[var(--color-brand-text-muted)] font-mono-numbers">
            {t.debts.paymentsSoFar(payments.length)}
          </p>
          <span className="text-xs font-mono-numbers text-[var(--color-brand-text-secondary)]">
            {t.debts.percentCleared(paidPercent.toFixed(1))}
          </span>
        </div>

        {debt.isGold && goldOk ? (
          <p className="text-xs text-[var(--color-brand-gold)] flex items-center gap-1">
            {debt.goldKarat || 24}K gold @ {formatCurrency(goldPricePerGram * (debt.goldKarat || 24) / 24, base)}/g
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-green)] animate-pulse" />
          </p>
        ) : debt.isGold ? (
          <p className="text-xs text-[var(--color-brand-text-muted)] italic">{t.settings.goldPriceUnavailable}</p>
        ) : null}
      </div>

      {paidOff ? (
        <p className="w-full mt-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-center text-sm text-[var(--color-brand-text-muted)]">
          {t.debts.clearedMessage}
        </p>
      ) : onPayInstallment ? (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={onPayInstallment}
            className="w-full py-2.5 rounded-xl bg-[var(--color-brand-green)] hover:bg-[var(--color-brand-green-hover)] text-white text-sm font-medium transition-colors"
          >
            {t.debts.payNextInstallment}
          </button>
          <button
            type="button"
            onClick={onRecordPayment}
            className="w-full py-2 rounded-xl border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] text-sm font-medium transition-colors"
          >
            {t.debts.buttonLogPayment}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onRecordPayment}
          className="w-full mt-4 py-2.5 rounded-xl bg-[var(--color-brand-green)] hover:bg-[var(--color-brand-green-hover)] text-white text-sm font-medium transition-colors"
        >
          {t.debts.buttonLogPayment}
        </button>
      )}
    </div>
  )
}
