'use client'

import { CreditCard, ChevronRight, ChevronLeft } from 'lucide-react'
import { useT, useLocale } from '@/lib/i18n'
import type { FinanceStore } from '@/lib/store/types'

export interface SettingsPaymentMethodsSectionProps {
  store: FinanceStore
  onOpen: () => void
}

/**
 * Entry row into the Payment methods wallet sheet (management lives in the sheet
 * — no list here, per the v4 handoff). Shows the saved-card count.
 */
export function SettingsPaymentMethodsSection({ store, onOpen }: SettingsPaymentMethodsSectionProps) {
  const t = useT()
  const { locale } = useLocale()
  const count = store.paymentMethods.filter((m) => m.type !== 'cash').length
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight

  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] overflow-hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 min-h-11 py-2.5 text-start transition-colors hover:bg-[var(--color-brand-elevated)]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-elevated)]">
          <CreditCard className="h-4 w-4 text-[var(--color-brand-red)]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-[var(--color-brand-text-primary)]">
            {t.paymentMethods.title}
          </span>
          <span className="block text-xs text-[var(--color-brand-text-muted)] mt-0.5">
            {count > 0 ? t.paymentMethods.savedCount.replace('{n}', String(count)) : t.paymentMethods.manageSubtitle}
          </span>
        </span>
        <Chevron className="h-4 w-4 shrink-0 text-[var(--color-brand-text-muted)]" />
      </button>
    </div>
  )
}
