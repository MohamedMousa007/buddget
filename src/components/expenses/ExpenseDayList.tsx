'use client'

import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { format, parseISO, subDays } from 'date-fns'
import { CircleSlash } from 'lucide-react'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { SwipeToDelete } from '@/components/expenses/SwipeToDelete'
import { Badge } from '@/components/ui/badge'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { useLinkedDelete } from '@/hooks/useLinkedDelete'
import { categoryChipColors } from '@/lib/expenses/categoryChip'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useExpenseFilterStore, amountIsFiltered } from '@/lib/store/useExpenseFilterStore'
import { expenseAmountInBase, isExpenseUnconverted } from '@/lib/utils/calculations'
import { isNonSpendExpense } from '@/lib/constants/categoryMeta'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import type { Expense } from '@/lib/store/types'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'
import { accountIdentifier } from '@/components/features/accounts/accountDisplay'
import { Button } from '@/components/ui/button'

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
  /** True when a day's total leaves out an expense that has no rate to base currency. */
  incomplete: boolean
  items: Expense[]
}

export function ExpenseDayList({ expenses }: { expenses: Expense[] }) {
  const t = useT()
  const { locale } = useLocale()
  const { settings, exchangeRates, paymentMethods } = useFinanceStore(
    useShallow((s) => ({
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      paymentMethods: s.paymentMethods,
    })),
  )
  const { setEditingExpenseId, setActiveModal } = useSettingsStore()
  const { isMonthRange, hasFilters, resetFilters } = useExpenseFilterStore(
    useShallow((s) => ({
      isMonthRange: s.range.preset === 'month',
      hasFilters:
        s.cats.length > 0 ||
        s.methods.length > 0 ||
        s.range.preset !== 'month' ||
        amountIsFiltered(s.amtMin, s.amtMax),
      resetFilters: s.reset,
    })),
  )
  const { removeExpense } = useLinkedDelete()
  const [openId, setOpenId] = useState<string | null>(null)
  const base = settings.baseCurrency
  const secondary = settings.secondaryCurrency
  const showSecondary = settings.showSecondaryCurrency && secondary

  const groups = useMemo<DayGroup[]>(() => {
    // Local, not UTC: `e.date` is a local date-only string, so a UTC key mislabels
    // "Today" as a plain date between midnight and dawn at UTC+2/+3.
    const now = new Date()
    const todayKey = format(now, 'yyyy-MM-dd')
    const yesterdayKey = format(subDays(now, 1), 'yyyy-MM-dd')

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
      abs: formatLocalized(parseISO(key), 'MMM d', locale),
      total: items.reduce((sum, e) => isNonSpendExpense(e) ? sum : sum + expenseAmountInBase(e, base, exchangeRates), 0),
      incomplete: items.some((e) => !isNonSpendExpense(e) && isExpenseUnconverted(e, base, exchangeRates)),
      items,
    }))
  }, [expenses, base, exchangeRates, t, locale])

  const openEdit = (id: string) => {
    setEditingExpenseId(id)
    setActiveModal('editExpense')
  }

  const handleDelete = (e: Expense) => {
    setOpenId(null)
    void removeExpense(e)
  }

  if (expenses.length === 0) {
    return (
      <div className="px-1 py-10 text-center">
        {/* `emptyTitle` hardcodes "this month" — with a Today/week/custom range it would
            contradict the hero directly above it. */}
        <p className="text-sm text-[var(--color-brand-text-muted)]">
          {isMonthRange ? t.expenses.emptyTitle : t.expenses.emptyInRange}
        </p>
        {hasFilters ? (
          <Button variant="ghost" size="touch" onClick={resetFilters} className="mt-3 font-semibold">
            {t.expenses.clearFilters}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <>
      {groups.map((g, gIdx) => (
        <div key={g.key}>
          <div className={`flex items-baseline justify-between px-[18px] pb-2 ${gIdx === 0 ? 'pt-[22px]' : 'pt-5'}`}>
            <span className="flex items-baseline gap-2">
              <span className="text-[0.9375rem] font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">
                {g.rel ?? g.abs}
              </span>
              {g.rel ? (
                <span className="font-mono-numbers text-xs font-medium text-[var(--color-brand-text-muted)]">{g.abs}</span>
              ) : null}
            </span>
            <span className="font-mono-numbers whitespace-nowrap text-[0.6875rem] font-medium tabular-nums text-[var(--color-brand-text-muted)]">
              {g.incomplete ? '≥ ' : ''}−{fmtNum(g.total)} {base}
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
              const statusDate = formatLocalized(parseISO(e.refundedAt ?? e.date), 'MMM d', locale)
              const nonSpend = isNonSpendExpense(e)
              return (
                <div key={e.id}>
                  {idx > 0 ? <div className="ms-[82px] h-px bg-[var(--color-brand-border)]" /> : null}
                  <SwipeToDelete
                    openSide={openId === e.id ? 'left' : null}
                    onOpenChange={(side) => setOpenId(side ? e.id : null)}
                    onDelete={() => handleDelete(e)}
                    deleteLabel={t.expenses.swipeDelete}
                  >
                    <TransactionRow
                      icon={<CategoryIcon category={e.category} className="h-5 w-5" />}
                      iconBg={colors.bg}
                      iconFg={colors.fg}
                      caption={categoryLabel(t, e.category)}
                      captionColor={colors.fg}
                      dimmed={netZero}
                      onClick={() => openEdit(e.id)}
                      title={e.description}
                      titleBadge={
                        e.refundKind === 'declined' ? (
                          <Badge variant="negative" size="xs" className="shrink-0">{t.expenses.badgeDeclined}</Badge>
                        ) : e.refundKind === 'refunded' ? (
                          <Badge variant="positive" size="xs" className="shrink-0">{t.expenses.badgeRefunded}</Badge>
                        ) : e.spendExclusion === 'for_someone' ? (
                          <Badge variant="muted" size="xs" className="shrink-0">{e.owedSettledAt ? t.exclusion.badgeRepaid : t.exclusion.badgeOwed(e.owedBy ?? t.exclusion.forSomeone)}</Badge>
                        ) : nonSpend ? (
                          <CircleSlash role="img" aria-label={t.expenses.badgeNotCounted} className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand-text-muted)]" />
                        ) : null
                      }
                      subtitle={
                        method && accountIdentifier(method) ? (
                          <><span className="truncate">{decomposePaymentMethodName(method.name, method.last4).provider}</span><span className="ms-1 shrink-0">{accountIdentifier(method)}</span></>
                        ) : (method?.name || t.common.unknown)
                      }
                      amount={<span className={netZero ? 'line-through' : ''}>−{fmtNum(baseVal)}</span>}
                      amountColor={netZero ? 'var(--color-brand-text-secondary)' : nonSpend ? 'var(--color-brand-text-muted)' : 'var(--color-brand-text-primary)'}
                      sub={
                        e.refundKind === 'refunded' ? (
                          <span className="font-semibold" style={{ color: 'var(--color-status-ok-fg)' }}>↩ {t.expenses.statusReturned} {statusDate}</span>
                        ) : e.refundKind === 'declined' ? (
                          <span className="font-semibold">✕ {t.expenses.statusBlocked} {statusDate}</span>
                        ) : usd ? (<>≈ −{usd}</>) : null
                      }
                    />
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
