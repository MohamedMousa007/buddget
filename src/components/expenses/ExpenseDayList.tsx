'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { format, parseISO } from 'date-fns'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { SwipeToDelete } from '@/components/expenses/SwipeToDelete'
import { useActionToast } from '@/components/ui/ActionToast'
import { categoryChipColors } from '@/lib/expenses/categoryChip'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { expenseAmountInBase } from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import type { Expense } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface DayGroup {
  key: string
  /** Relative label ("Today"/"Yesterday") or null for a plain date group. */
  rel: string | null
  /** Absolute short date, e.g. "Jul 9". */
  abs: string
  total: number
  items: Expense[]
}

export function ExpenseDayList({ expenses }: { expenses: Expense[] }) {
  const t = useT()
  const { settings, exchangeRates, paymentMethods, deleteExpense, restoreExpense } = useFinanceStore(
    useShallow((s) => ({
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      paymentMethods: s.paymentMethods,
      deleteExpense: s.deleteExpense,
      restoreExpense: s.restoreExpense,
    })),
  )
  const { setEditingExpenseId, setActiveModal } = useSettingsStore()
  const { formatTime } = useLocalizedFormatters()
  const toast = useActionToast()
  const [openId, setOpenId] = useState<string | null>(null)
  const base = settings.baseCurrency
  const secondary = settings.secondaryCurrency
  const showSecondary = settings.showSecondaryCurrency && secondary

  const groups = useMemo<DayGroup[]>(() => {
    const now = new Date()
    const todayKey = now.toISOString().slice(0, 10)
    const yest = new Date(now)
    yest.setDate(now.getDate() - 1)
    const yesterdayKey = yest.toISOString().slice(0, 10)

    const map = new Map<string, Expense[]>()
    for (const e of expenses) {
      const key = e.date.slice(0, 10)
      const arr = map.get(key)
      if (arr) arr.push(e)
      else map.set(key, [e])
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      rel: key === todayKey ? t.common.today : key === yesterdayKey ? t.common.yesterday : null,
      abs: format(parseISO(key), 'MMM d'),
      total: items.reduce((sum, e) => sum + expenseAmountInBase(e, base, exchangeRates), 0),
      items,
    }))
  }, [expenses, base, exchangeRates, t])

  const openEdit = (id: string) => {
    setEditingExpenseId(id)
    setActiveModal('editExpense')
  }

  const handleDelete = (e: Expense) => {
    setOpenId(null)
    deleteExpense(e.id)
    toast(t.expenses.expenseDeleted, { undo: () => restoreExpense(e), undoLabel: t.common.undo })
  }

  if (expenses.length === 0) {
    return (
      <p className="px-1 py-10 text-center text-sm text-[var(--color-brand-text-muted)]">
        {t.expenses.emptyTitle}
      </p>
    )
  }

  return (
    <>
      {groups.map((g, gIdx) => (
        <div key={g.key}>
          <div className={`flex items-baseline justify-between px-[18px] pb-2 ${gIdx === 0 ? 'pt-[22px]' : 'pt-5'}`}>
            <span className="flex items-baseline gap-2">
              <span className="text-[15px] font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">
                {g.rel ?? g.abs}
              </span>
              {g.rel ? (
                <span className="font-mono-numbers text-xs font-medium text-[var(--color-brand-text-muted)]">{g.abs}</span>
              ) : null}
            </span>
            <span className="font-mono-numbers whitespace-nowrap text-[11px] font-medium tabular-nums text-[var(--color-brand-text-muted)]">
              −{fmtNum(g.total)} {base}
            </span>
          </div>
          <div className="border-y border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
            {g.items.map((e, idx) => {
              const colors = categoryChipColors(e.category)
              const method = paymentMethods.find((m) => m.id === e.paymentMethodId)
              // Refunded/declined rows net to zero in totals; show the gross original here.
              const baseVal = expenseAmountInBase(e, base, exchangeRates, !!e.refundKind)
              const netZero = !!e.refundKind
              const usd = showSecondary && secondary
                ? formatCurrency(convertCurrency(baseVal, base, secondary, exchangeRates), secondary)
                : null
              const statusDate = format(parseISO(e.refundedAt ?? e.date), 'MMM d')
              return (
                <div key={e.id}>
                  {idx > 0 ? <div className="ml-[82px] h-px bg-[var(--color-brand-border)]" /> : null}
                  <SwipeToDelete
                    isOpen={openId === e.id}
                    onOpenChange={(open) => setOpenId(open ? e.id : null)}
                    onDelete={() => handleDelete(e)}
                    deleteLabel={t.expenses.swipeDelete}
                  >
                    <button
                      type="button"
                      onClick={() => openEdit(e.id)}
                      className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-[var(--color-brand-elevated)]"
                    >
                      {/* A. Icon column */}
                      <span className="flex w-[54px] shrink-0 flex-col items-center gap-[5px]">
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-[11px] ${netZero ? 'opacity-50' : ''}`}
                          style={{ background: colors.bg, color: colors.fg }}
                        >
                          <CategoryIcon category={e.category} className="h-5 w-5" />
                        </span>
                        <span
                          className="max-w-[54px] truncate text-center text-[9.5px] font-semibold leading-none"
                          style={{ color: colors.fg }}
                        >
                          {e.category}
                        </span>
                      </span>

                      {/* B. Middle column */}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 overflow-hidden">
                          <span className="truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">
                            {e.description}
                          </span>
                          {e.refundKind === 'declined' ? (
                            <span
                              className="shrink-0 rounded-full px-2 py-[2.5px] text-[9.5px] font-extrabold uppercase tracking-[0.05em]"
                              style={{ background: 'rgba(229,9,20,0.14)', color: '#F76D74' }}
                            >
                              {t.expenses.badgeDeclined}
                            </span>
                          ) : e.refundKind === 'refunded' ? (
                            <span
                              className="shrink-0 rounded-full px-2 py-[2.5px] text-[9.5px] font-extrabold uppercase tracking-[0.05em]"
                              style={{ background: 'rgba(29,185,84,0.16)', color: '#1DB954' }}
                            >
                              {t.expenses.badgeRefunded}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1.5 flex items-center whitespace-nowrap">
                          <span className="font-mono-numbers text-xs font-semibold text-[var(--color-brand-text-secondary)]">
                            {formatTime(e.date)}
                          </span>
                          <span className="ml-[9px] flex min-w-0 items-center border-l border-[var(--color-brand-border)] pl-[9px]">
                            {method?.last4 ? (
                              <>
                                <span className="font-mono-numbers truncate text-xs font-medium text-[var(--color-brand-text-muted)]">
                                  {method.name}
                                </span>
                                <span className="font-mono-numbers ml-1 shrink-0 text-xs font-medium text-[var(--color-brand-text-muted)]">
                                  ••••{method.last4}
                                </span>
                              </>
                            ) : (
                              <span className="font-mono-numbers truncate text-xs font-medium text-[var(--color-brand-text-muted)]">
                                {method?.name || t.common.unknown}
                              </span>
                            )}
                          </span>
                        </span>
                      </span>

                      {/* C. Amount column */}
                      <span className="shrink-0 text-end">
                        <span
                          className={`font-mono-numbers block text-[15px] font-medium tabular-nums ${netZero ? 'text-[var(--color-brand-text-secondary)] line-through' : 'text-[var(--color-brand-text-primary)]'}`}
                        >
                          −{fmtNum(baseVal)}
                        </span>
                        {e.refundKind === 'refunded' ? (
                          <span className="font-mono-numbers mt-[3px] block text-[10.5px] font-semibold" style={{ color: '#1DB954' }}>
                            ↩ {t.expenses.statusReturned} {statusDate}
                          </span>
                        ) : e.refundKind === 'declined' ? (
                          <span className="font-mono-numbers mt-[3px] block text-[10.5px] font-semibold text-[var(--color-brand-text-muted)]">
                            ✕ {t.expenses.statusBlocked} {statusDate}
                          </span>
                        ) : usd ? (
                          <span className="font-mono-numbers mt-[3px] block text-[11.5px] font-medium text-[var(--color-brand-text-muted)]">
                            ≈ −{usd}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </SwipeToDelete>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
