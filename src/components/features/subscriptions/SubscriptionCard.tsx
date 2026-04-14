'use client'

import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { findBrandByKey } from '@/lib/constants/subscriptionCatalog'
import { SubscriptionCardInfo } from '@/components/features/subscriptions/SubscriptionCardInfo'
import { SubscriptionCardMenu } from '@/components/features/subscriptions/SubscriptionCardMenu'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { useT } from '@/lib/i18n'
import type { Subscription } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'

/**
 * Single subscription row with overflow menu for edit / cancel / reactivate / delete.
 */
export function SubscriptionCard({
  sub,
  onEdit,
  dimmed,
}: {
  sub: Subscription
  onEdit: () => void
  dimmed?: boolean
}) {
  const t = useT()
  const { formatDateShort } = useLocalizedFormatters()
  const [menuOpen, setMenuOpen] = useState(false)
  const { paymentMethods, cancelSubscription, deleteSubscription, reactivateSubscription } =
    useFinanceStore(
      useShallow((s) => ({
        paymentMethods: s.paymentMethods,
        cancelSubscription: s.cancelSubscription,
        deleteSubscription: s.deleteSubscription,
        reactivateSubscription: s.reactivateSubscription,
      }))
    )

  const brand = findBrandByKey(sub.brandKey)
  const pm = sub.paymentMethodId ? paymentMethods.find((m) => m.id === sub.paymentMethodId) : null
  const pmLabel = pm ? `${pm.name}${pm.last4 ? ` ••${pm.last4}` : ''}` : '—'

  const cycleLabel =
    sub.billingCycle === 'yearly'
      ? t.subscriptions.perYear
      : sub.billingCycle === 'weekly'
        ? t.subscriptions.perWeek
        : sub.billingCycle === 'quarterly'
          ? t.subscriptions.perQuarter
          : t.subscriptions.perMonth

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3',
        dimmed && 'opacity-70'
      )}
    >
      <SubscriptionCardInfo
        sub={sub}
        brand={brand}
        pmLabel={pmLabel}
        formatDateShort={formatDateShort}
        t={t.subscriptions}
      />
      <div className="text-end shrink-0">
        <p className="text-sm font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">
          {formatCurrency(sub.amount, sub.currency)}
          <span className="text-xs font-normal text-[var(--color-brand-text-muted)]">{cycleLabel}</span>
        </p>
        <button
          type="button"
          className="mt-1 p-1 rounded-lg hover:bg-[var(--color-brand-card)] text-[var(--color-brand-text-muted)]"
          aria-expanded={menuOpen}
          aria-label="Menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {menuOpen ? (
        <SubscriptionCardMenu
          sub={sub}
          onEdit={onEdit}
          onClose={() => setMenuOpen(false)}
          cancelSubscription={cancelSubscription}
          deleteSubscription={deleteSubscription}
          reactivateSubscription={reactivateSubscription}
        />
      ) : null}
    </div>
  )
}
