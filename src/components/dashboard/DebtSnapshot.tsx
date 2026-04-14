'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import {
  calculateDebtRemaining,
  goldGramsToMoney,
} from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import { MoneyDisplay } from '@/components/ui/MoneyDisplay'
import { useT } from '@/lib/i18n'
import { formatCurrency } from '@/lib/utils/formatters'

function supabaseAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  )
}

export function DebtSnapshot() {
  const t = useT()
  const { session } = useAuth()
  const hideFinance = supabaseAuthConfigured() && session == null
  const { debts, debtPayments, settings, exchangeRates, goldPricePerGram, goldPriceAvailable } =
    useFinanceStore(
      useShallow((s) => ({
        debts: s.debts,
        debtPayments: s.debtPayments,
        settings: s.settings,
        exchangeRates: s.exchangeRates,
        goldPricePerGram: s.goldPricePerGram,
        goldPriceAvailable: s.goldPriceAvailable,
      }))
    )
  const base = settings.baseCurrency
  const goldOk = goldPriceAvailable !== false

  if (hideFinance) return null
  if (debts.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
        {t.dashboard.debtTitle}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {debts.map((debt) => {
          const remainingRaw = calculateDebtRemaining(debt, debtPayments)
          const remainingInBase =
            debt.isGold && !goldOk
              ? null
              : debt.isGold
                ? goldGramsToMoney(remainingRaw, goldPricePerGram, debt.goldKarat)
                : convertCurrency(remainingRaw, debt.currency, base, exchangeRates)

          const paymentsCount = debtPayments.filter((p) => p.debtId === debt.id).length
          const progressPercent = debt.startingBalance > 0
            ? ((debt.startingBalance - remainingRaw) / debt.startingBalance) * 100
            : 0

          return (
            <Link href="/debts" key={debt.id}>
              <div className="glass-card rounded-2xl p-4 hover:bg-[var(--color-brand-elevated)] transition-colors cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{debt.isGold ? '🪙' : '💵'}</span>
                  <h4 className="text-sm font-medium text-[var(--color-brand-text-primary)]">{debt.name}</h4>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                    debt.isGold
                      ? 'bg-[var(--color-brand-gold)]/20 text-[var(--color-brand-gold)]'
                      : 'bg-[var(--color-brand-green)]/20 text-[var(--color-brand-green)]'
                  }`}>
                    {debt.isGold ? `${debt.goldKarat || 24}K` : t.dashboard.debtBadgeCash}
                  </span>
                </div>

                {debt.isGold && !goldOk ? (
                  <div className="space-y-1">
                    <p className="text-lg font-bold font-mono-numbers text-[var(--color-brand-text-primary)]">
                      {formatCurrency(remainingRaw, 'XAU')}
                    </p>
                    <p className="text-[10px] text-[var(--color-brand-text-muted)] italic flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden />
                      {t.savings.goldAedUnavailable}
                    </p>
                  </div>
                ) : (
                  <MoneyDisplay
                    amount={remainingRaw}
                    currency={debt.isGold ? 'XAU' : debt.currency}
                    amountInPrimary={remainingInBase ?? undefined}
                    variant="card"
                    primaryClassName="text-lg font-bold text-[var(--color-brand-text-primary)]"
                  />
                )}

                {debt.isGold && goldOk ? (
                  <p className="text-xs text-[var(--color-brand-gold)] font-mono-numbers">
                    {remainingRaw.toFixed(1)}g × {debt.goldKarat || 24}K
                  </p>
                ) : null}

                <div className="mt-2 h-1.5 bg-[var(--color-brand-border)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--color-brand-red)]"
                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                  />
                </div>

                <p className="text-xs text-[var(--color-brand-text-muted)] mt-2">
                  {t.dashboard.debtPayments(paymentsCount)}{t.dashboard.debtPaymentsTowardsThis}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
