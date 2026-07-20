'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Check, CreditCard as CardIcon, Layers, HandCoins } from 'lucide-react'
import { SwipeToDelete, type SwipeSide } from '@/components/expenses/SwipeToDelete'
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
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[17px] font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">All debt payments</h2>
      </div>
      <div className="mt-3 flex gap-2 px-1">
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
            <div className="overflow-hidden border-y border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
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
                      <div className="flex min-h-[60px] w-full items-center gap-3 bg-[var(--color-brand-card)] px-4 py-2.5">
                        <div className="flex w-[54px] shrink-0 flex-col items-center gap-[5px]">
                          <span
                            className="flex h-10 w-10 items-center justify-center rounded-[11px]"
                            style={{ background: `${accent}22`, color: accent }}
                          >
                            <meta.Icon className="h-5 w-5" />
                          </span>
                          <span className="max-w-[54px] truncate text-[9.5px] font-semibold leading-none" style={{ color: accent }}>
                            {meta.label}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{p.name}</p>
                          <p className="mt-1.5 truncate font-mono-numbers text-xs font-medium text-[var(--color-brand-text-muted)]">
                            {format(parseISO(p.date), 'MMM d')}
                            {p.method ? ` · ${p.method}` : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-end">
                          <span className="font-mono-numbers block text-[15px] font-medium tabular-nums text-[var(--color-brand-text-primary)]">
                            −{fmtWhole(p.amount)}
                          </span>
                          <span className="mt-[3px] inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-[#35D46F]">
                            <Check className="h-3 w-3" strokeWidth={3} /> Paid
                          </span>
                        </div>
                      </div>
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
