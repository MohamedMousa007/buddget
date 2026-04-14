'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { RefreshCw } from 'lucide-react'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { SubscriptionCard } from '@/components/features/subscriptions/SubscriptionCard'
import { AddSubscriptionSheet } from '@/components/modals/AddSubscriptionSheet'
import { MoneyDisplay } from '@/components/ui/MoneyDisplay'
import { useSubscriptionsMonthlyBaseTotal } from '@/hooks/useSubscriptionsMonthlyTotal'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import type { Subscription } from '@/lib/store/types'

export default function SubscriptionsPage() {
  const t = useT()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Subscription | null>(null)
  const [instanceKey, setInstanceKey] = useState(0)
  const monthlyTotal = useSubscriptionsMonthlyBaseTotal()
  const { subscriptions, settings } = useFinanceStore(
    useShallow((s) => ({ subscriptions: s.subscriptions, settings: s.settings }))
  )

  const { active, cancelled } = useMemo(() => {
    const a = subscriptions.filter((s) => s.status === 'active' || s.status === 'trial' || s.status === 'paused')
    const c = subscriptions.filter((s) => s.status === 'cancelled')
    return { active: a, cancelled: c }
  }, [subscriptions])

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
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <div className="flex items-center justify-between gap-4 w-full">
            <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)] flex items-center gap-2">
              <RefreshCw className="w-6 h-6 text-[var(--color-brand-red)]" aria-hidden />
              {t.subscriptions.pageTitle}
            </h1>
            <button
              type="button"
              onClick={openAdd}
              className="shrink-0 px-4 py-2 rounded-xl bg-[var(--color-brand-red)] text-sm font-medium text-[var(--color-brand-text-primary)]"
            >
              {t.subscriptions.addSubscription}
            </button>
          </div>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
        <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--color-brand-text-muted)]">
            {t.subscriptions.totalMonthly}
          </p>
          <p className="text-2xl font-bold font-mono-numbers text-[var(--color-brand-text-primary)] mt-1">
            <MoneyDisplay amount={monthlyTotal} currency={settings.baseCurrency} variant="inline" />
            <span className="text-sm font-normal text-[var(--color-brand-text-muted)] ms-1">
              {t.subscriptions.perMonth}
            </span>
          </p>
        </div>

        {subscriptions.length === 0 ? (
          <EmptyState
            title={t.subscriptions.emptyTitle}
            description={t.subscriptions.emptyHint}
            action={
              <button
                type="button"
                onClick={openAdd}
                className="px-5 py-2.5 rounded-xl bg-[var(--color-brand-red)] text-sm font-medium text-[var(--color-brand-text-primary)]"
              >
                {t.subscriptions.addSubscription}
              </button>
            }
          />
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)] mb-2">
                {t.subscriptions.activeSection(active.length)}
              </p>
              <div className="space-y-2">
                {active.map((s) => (
                  <SubscriptionCard key={s.id} sub={s} onEdit={() => openEdit(s)} />
                ))}
              </div>
            </div>
            {cancelled.length > 0 ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)] mb-2">
                  {t.subscriptions.cancelledSection}
                </p>
                <div className="space-y-2">
                  {cancelled.map((s) => (
                    <SubscriptionCard key={s.id} sub={s} onEdit={() => openEdit(s)} dimmed />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <AddSubscriptionSheet
        open={sheetOpen}
        onClose={closeSheet}
        editing={editing}
        instanceKey={instanceKey}
      />
    </div>
  )
}
