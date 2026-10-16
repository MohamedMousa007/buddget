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
import { OptionChip } from '@/components/ui/OptionChip'
import { useT } from '@/lib/i18n'
import { soft } from './heroCardShared'

const FAMILY_ICON: Record<DebtFamily, typeof Check> = {
  borrow: HandCoins,
  credit_card: CardIcon,
  installment: Layers,
}

/** Cross-tab "All debt payments" feed — day-grouped, swipe-to-delete (handoff §2.5). */
export function DebtPaymentsFeed({ payments, currentFamily }: { payments: PaymentVM[]; currentFamily: DebtFamily }) {
  const t = useT().debts
  const familyLabel: Record<DebtFamily, string> = { borrow: t.feedBorrow, credit_card: t.feedCard, installment: t.feedPlan }
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
    <OptionChip
      key={val}
      onClick={() => setFilter(val)}
      selected={filter === val}
      size="sm"
    >
      {label}
    </OptionChip>
  )

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between px-[18px]">
        <h2 className="text-[17px] font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">{t.feedTitle}</h2>
      </div>
      <div className="mt-3 flex gap-2 px-[18px]">
        {chip('all', t.feedAll)}
        {chip(currentFamily, familyLabel[currentFamily])}
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
                const FamilyIcon = FAMILY_ICON[p.family]
                const accent = FAMILY_ACCENT[p.family]
                return (
                  <div key={p.id}>
                    {i > 0 ? <div className="ms-[82px] h-px bg-[var(--color-brand-border)]" /> : null}
                    <SwipeToDelete
                      openSide={openRow?.id === p.id ? openRow.side : null}
                      onOpenChange={(side) => setOpenRow(side ? { id: p.id, side } : null)}
                      onDelete={() => {
                        setOpenRow(null)
                        deleteDebtPayment(p.id)
                        toast(t.feedDeleted)
                      }}
                      deleteLabel="Delete"
                    >
                      <TransactionRow
                        icon={<FamilyIcon className="h-5 w-5" />}
                        iconBg={soft(accent, 16)}
                        iconFg={accent}
                        caption={familyLabel[p.family]}
                        captionColor={accent}
                        title={p.name}
                        subtitle={`${format(parseISO(p.date), 'MMM d')}${p.method ? ` · ${p.method}` : ''}`}
                        amount={`−${fmtWhole(p.amount)}`}
                        sub={<span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: 'var(--color-brand-green)' }}><Check className="h-3 w-3" strokeWidth={3} /> {t.feedPaid}</span>}
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
