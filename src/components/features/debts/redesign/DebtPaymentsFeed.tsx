'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Check, CreditCard as CardIcon, Layers, HandCoins } from 'lucide-react'
import { SwipeToDelete, type SwipeSide } from '@/components/expenses/SwipeToDelete'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { useActionToast } from '@/components/ui/ActionToast'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { FAMILY_ACCENT, type PaymentVM } from '@/hooks/useDebtTabData'
import type { DebtFamily } from '@/lib/debts/debtFamily'
import { fmtWhole } from './heroCardShared'

const FAMILY_META: Record<DebtFamily, { label: string; Icon: typeof Check }> = {
  borrow: { label: 'Borrow', Icon: HandCoins },
  credit_card: { label: 'Card', Icon: CardIcon },
  installment: { label: 'Plan', Icon: Layers },
}

/** Cross-tab "All debt payments" feed — day-grouped, swipe-to-delete (handoff §2.5). */
export function DebtPaymentsFeed({ payments, currentFamily }: { payments: PaymentVM[]; currentFamily: DebtFamily }) {
  const deleteDebtPayment = useFinanceStore((s) => s.deleteDebtPayment)
  const toast = useActionToast()
  const [filter, setFilter] = useState<'all' | DebtFamily>('all')
  const [openRow, setOpenRow] = useState<{ id: string; side: SwipeSide } | null>(null)

  const shown = useMemo(
    () => (filter === 'all' ? payments : payments.filter((p) => p.family === filter)),
    [payments, filter],
  )

  const groups = useMemo(() => {
    const map = new Map<string, PaymentVM[]>()
    for (const p of shown) {
      const key = p.date.slice(0, 10)
      const arr = map.get(key)
      if (arr) arr.push(p)
      else map.set(key, [p])
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: format(parseISO(key), 'MMM d'),
      total: items.reduce((s, x) => s + x.amount, 0),
      items,
    }))
  }, [shown])

  if (payments.length === 0) return null

  const chip = (val: 'all' | DebtFamily, label: string) => (
    <button
      key={val}
      type="button"
      onClick={() => setFilter(val)}
      className={`h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
        filter === val
          ? 'bg-[var(--color-brand-red)] text-white'
          : 'border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between px-[18px]">
        <h2 className="text-[17px] font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">All debt payments</h2>
      </div>
      <div className="mt-3 flex gap-2 px-[18px]">
        {chip('all', 'All')}
        {chip(currentFamily, FAMILY_META[currentFamily].label)}
      </div>

      <div className="mt-3">
        {groups.map((g, gi) => (
          <div key={g.key}>
            <div className={`flex items-baseline justify-between px-[18px] pb-2 ${gi === 0 ? 'pt-1' : 'pt-5'}`}>
              <span className="text-[15px] font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">{g.label}</span>
              <span className="font-mono-numbers text-[11px] font-medium tabular-nums text-[var(--color-brand-text-muted)]">
                −{fmtWhole(g.total)}
              </span>
            </div>
            <div className="border-y border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
              {g.items.map((p, i) => {
                const meta = FAMILY_META[p.family]
                const accent = FAMILY_ACCENT[p.family]
                return (
                  <div key={p.id}>
                    {i > 0 ? <div className="ml-[82px] h-px bg-[var(--color-brand-border)]" /> : null}
                    <SwipeToDelete
                      openSide={openRow?.id === p.id ? openRow.side : null}
                      onOpenChange={(side) => setOpenRow(side ? { id: p.id, side } : null)}
                      onDelete={() => {
                        setOpenRow(null)
                        deleteDebtPayment(p.id)
                        toast('Payment deleted')
                      }}
                      deleteLabel="Delete"
                    >
                      <TransactionRow
                        icon={<meta.Icon className="h-5 w-5" />}
                        iconBg={`${accent}22`}
                        iconFg={accent}
                        caption={meta.label}
                        captionColor={accent}
                        title={p.name}
                        subtitle={`${format(parseISO(p.date), 'MMM d')}${p.method ? ` · ${p.method}` : ''}`}
                        amount={`−${fmtWhole(p.amount)}`}
                        sub={<span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: '#35D46F' }}><Check className="h-3 w-3" strokeWidth={3} /> Paid</span>}
                      />
                    </SwipeToDelete>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
