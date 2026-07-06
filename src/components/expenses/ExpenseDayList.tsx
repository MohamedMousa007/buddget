'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { SwipeToDelete } from '@/components/expenses/SwipeToDelete'
import { useActionToast } from '@/components/ui/ActionToast'
import { categoryChipColors } from '@/lib/expenses/categoryChip'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { expenseAmountInBase } from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import type { Expense } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function dayLabel(dateStr: string, todayKey: string, yesterdayKey: string): string {
  const d = new Date(dateStr)
  const md = `${MONTHS[d.getMonth()]} ${d.getDate()}`
  const key = dateStr.slice(0, 10)
  if (key === todayKey) return `TODAY · ${md}`
  if (key === yesterdayKey) return `YESTERDAY · ${md}`
  return md
}

interface DayGroup {
  key: string
  label: string
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
  const toast = useActionToast()
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
      label: dayLabel(key, todayKey, yesterdayKey),
      total: items.reduce((sum, e) => sum + expenseAmountInBase(e, base, exchangeRates), 0),
      items,
    }))
  }, [expenses, base, exchangeRates])

  const openEdit = (id: string) => {
    setEditingExpenseId(id)
    setActiveModal('editExpense')
  }

  const handleDelete = (e: Expense) => {
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
      {groups.map((g) => (
        <div key={g.key}>
          <div className="flex items-center justify-between px-1 pb-[5px] pt-[9px]">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--color-brand-text-muted)]">
              {g.label}
            </span>
            <span className="font-mono-numbers text-[10.5px] font-semibold text-[var(--color-brand-text-muted)]">
              −{fmtNum(g.total)} {base}
            </span>
          </div>
          <div className="overflow-hidden rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
            {g.items.map((e, idx) => {
              const colors = categoryChipColors(e.category)
              const method = paymentMethods.find((m) => m.id === e.paymentMethodId)
              const baseVal = expenseAmountInBase(e, base, exchangeRates)
              const isSms = e.notes?.includes('[auto from sms]')
              const usd = showSecondary && secondary
                ? formatCurrency(convertCurrency(baseVal, base, secondary, exchangeRates), secondary)
                : null
              return (
                <SwipeToDelete
                  key={e.id}
                  onDelete={() => handleDelete(e)}
                  deleteLabel={t.expenses.swipeDelete}
                >
                <button
                  type="button"
                  onClick={() => openEdit(e.id)}
                  className={`flex w-full items-center gap-[11px] px-3 py-[9px] text-start transition-colors hover:bg-[var(--color-brand-elevated)] ${idx === 0 ? '' : 'border-t border-[var(--color-brand-border)]'}`}
                >
                  <span
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
                    style={{ background: colors.bg, color: colors.fg }}
                  >
                    <CategoryIcon category={e.category} className="h-[17px] w-[17px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-[6px]">
                      <span className="truncate text-[13.5px] font-semibold text-[var(--color-brand-text-primary)]">
                        {e.description}
                      </span>
                      {isSms ? (
                        <span className="shrink-0 rounded-full bg-[rgba(29,185,84,0.12)] px-[6px] py-[2px] text-[9px] font-extrabold uppercase tracking-[0.04em] text-[var(--color-brand-green)]">
                          {t.expenses.badgeSms}
                        </span>
                      ) : e.isDebtPayment ? (
                        <span className="shrink-0 rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-[6px] py-[2px] text-[9px] font-extrabold uppercase tracking-[0.04em] text-[var(--color-brand-text-secondary)]">
                          {t.expenses.badgeDebt}
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--color-brand-text-muted)]">
                      {method?.name || t.common.unknown}
                    </span>
                  </span>
                  <span className="shrink-0 text-end">
                    <span className="font-mono-numbers block text-[14px] font-bold text-[var(--color-brand-red-text)]">
                      −{fmtNum(baseVal)}{' '}
                      <span className="text-[10px] font-medium text-[var(--color-brand-text-muted)]">{base}</span>
                    </span>
                    {usd ? (
                      <span className="font-mono-numbers block text-[9.5px] text-[var(--color-brand-text-muted)]">
                        −{usd}
                      </span>
                    ) : null}
                  </span>
                </button>
                </SwipeToDelete>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
