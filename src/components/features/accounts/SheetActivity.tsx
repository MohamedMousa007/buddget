'use client'

import { Plus, Receipt } from 'lucide-react'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { instantOf } from '@/lib/accounts/balance'
import { arrivesIn } from '@/lib/accounts/cardDetails'
import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { categoryChipColors } from '@/lib/expenses/categoryChip'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useLocale, useT } from '@/lib/i18n'
import { MASK } from '@/lib/privacy/mask'
import type { Expense, PaymentMethod } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { clockOf } from '@/lib/time/occurredAt'
import { localTodayISO } from '@/lib/utils/localDate'
import { moneyFlex } from './accountDisplay'

interface SheetActivityProps {
  title: string
  rows: Expense[]
  masked: boolean
  /** The account or card "Add an expense" preselects. */
  method: PaymentMethod
  emptyLine: string
  /** Closes the sheet before another modal opens over the page. */
  onLeave: () => void
}

/**
 * The account and card sheets' activity: always present so the sheet keeps its shape. Three skeleton rows until the
 * first server pull lands, then the rows, or a compact empty state whose one action adds an expense on this method.
 */
export function SheetActivity({ title, rows, masked, method, emptyLine, onLeave }: SheetActivityProps) {
  const all = useT()
  const { locale } = useLocale()
  const ready = useFinanceStore((s) => s.dataReady)
  const methods = useFinanceStore((s) => s.paymentMethods)
  const setEditingExpenseId = useSettingsStore((s) => s.setEditingExpenseId)
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const openAddExpenseWithPrefill = useSettingsStore((s) => s.openAddExpenseWithPrefill)

  // "Today · 20:42", "Yesterday · 08:15", "Nov 16 · 13:05": the day, then the clock time when the row has one.
  const now = new Date()
  const today = localTodayISO(now)
  const yesterday = localTodayISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const when = (e: Expense) => {
    const at = new Date(instantOf(e.occurredAt, e.date))
    const day = localTodayISO(at)
    const label = day === today ? all.common.today : day === yesterday ? all.common.yesterday : formatLocalized(at, 'MMM d', locale)
    const clock = clockOf(e.occurredAt, day)
    return clock ? `${label} \u00b7 ${clock}` : label
  }

  let body
  if (!ready) {
    body = (
      <div aria-busy="true" aria-label={all.common.loading} className="space-y-1 px-5">
        {[62, 48, 56].map((w) => (
          <div key={w} className="flex h-14 items-center gap-3">
            <span className="size-10 shrink-0 rounded-xl bg-[var(--color-brand-sunken)] motion-safe:animate-pulse" />
            <span className="flex-1 space-y-1.5">
              <span className="block h-3 rounded bg-[var(--color-brand-sunken)] motion-safe:animate-pulse" style={{ width: `${w}%` }} />
              <span className="block h-2.5 w-1/3 rounded bg-[var(--color-brand-sunken)] motion-safe:animate-pulse" />
            </span>
            <span className="h-3 w-12 rounded bg-[var(--color-brand-sunken)] motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    )
  } else if (rows.length === 0) {
    body = (
      <EmptyState variant="hero" className="px-5 py-3" icon={<Receipt />} title={emptyLine}
        action={<Button variant="secondary" size="touch" onClick={() => { onLeave(); openAddExpenseWithPrefill({ paymentMethodId: method.id, currency: String(method.currency) }) }}><Plus aria-hidden />{all.accountsPage.addExpense}</Button>} />
    )
  } else {
    body = rows.map((e) => (
      <TransactionRow key={e.id} icon={<CategoryIcon category={e.category} className="size-5" />}
        iconBg={categoryChipColors(e.category).bg} iconFg={categoryChipColors(e.category).fg} title={e.description || categoryLabel(all, e.category)}
        onClick={() => { onLeave(); setEditingExpenseId(e.id); setActiveModal('editExpense') }}
        subtitle={when(e)}
        amount={masked ? MASK : <>{arrivesIn(e, method.id, methods) ? '+' : '−'}{moneyFlex(e.amount, String(e.currency))} <span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{String(e.currency)}</span></>}
        amountColor={arrivesIn(e, method.id, methods) ? 'var(--color-brand-green)' : undefined} />
    ))
  }
  return (
    <section>
      <h3 className="px-5 pb-2 pt-2 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{title}</h3>
      {ready && rows.length > 0 ? <Card padding="none" divide className="mx-4 overflow-hidden rounded-2xl">{body}</Card> : body}
    </section>
  )
}
