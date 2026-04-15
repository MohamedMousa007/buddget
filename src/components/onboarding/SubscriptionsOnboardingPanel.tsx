'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { SubscriptionCard } from '@/components/features/subscriptions/SubscriptionCard'
import { AddSubscriptionSheet } from '@/components/modals/AddSubscriptionSheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils/formatters'
import type { Subscription } from '@/lib/store/types'

/**
 * Bidirectional onboarding panel: reads & writes the live `subscriptions` store.
 * Any subscription the user adds here appears on /subscriptions immediately, and
 * vice-versa — no staging, no separate "commit on finish" step.
 */
export function SubscriptionsOnboardingPanel() {
  const t = useT()
  const { subscriptions, settings } = useFinanceStore(
    useShallow((s) => ({ subscriptions: s.subscriptions, settings: s.settings }))
  )
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Subscription | null>(null)
  const [instanceKey, setInstanceKey] = useState(0)

  const active = useMemo(
    () => subscriptions.filter((s) => s.status !== 'cancelled'),
    [subscriptions]
  )
  const monthlyTotal = useMemo(
    () =>
      active.reduce((sum, s) => {
        const perMonth =
          s.billingCycle === 'yearly'
            ? s.amount / 12
            : s.billingCycle === 'quarterly'
              ? s.amount / 3
              : s.billingCycle === 'weekly'
                ? s.amount * 4.345
                : s.amount
        return sum + perMonth
      }, 0),
    [active]
  )

  const openAdd = () => {
    setEditing(null)
    setInstanceKey((k) => k + 1)
    setSheetOpen(true)
  }
  const openEdit = (s: Subscription) => {
    setEditing(s)
    setSheetOpen(true)
  }
  const closeSheet = () => {
    setSheetOpen(false)
    setEditing(null)
  }

  return (
    <div className="w-full space-y-3 text-start">
      {active.length > 0 ? (
        <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-brand-text-muted)]">
            {t.subscriptions.totalMonthly}
          </p>
          <p className="mt-1 text-lg font-bold font-mono-numbers text-[var(--color-brand-text-primary)]">
            {formatCurrency(monthlyTotal, settings.baseCurrency)}
          </p>
        </div>
      ) : (
        <EmptyState
          title={t.subscriptions.emptyTitle}
          description={t.subscriptions.emptyHint}
        />
      )}

      <div className="space-y-2">
        {active.map((s) => (
          <SubscriptionCard key={s.id} sub={s} onEdit={() => openEdit(s)} />
        ))}
      </div>

      <button
        type="button"
        onClick={openAdd}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-brand-border)] px-4 py-3 text-sm font-medium text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-red)] hover:text-[var(--color-brand-red)] transition-colors"
      >
        <Plus className="w-4 h-4" aria-hidden />
        {t.subscriptions.addSubscription}
      </button>

      <AddSubscriptionSheet
        open={sheetOpen}
        onClose={closeSheet}
        editing={editing}
        instanceKey={instanceKey}
      />
    </div>
  )
}
