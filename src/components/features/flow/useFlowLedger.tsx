'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { format, parseISO, subDays } from 'date-fns'
import { CircleSlash, Link2, MessageSquare } from 'lucide-react'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { IncomeTypeIcon } from '@/components/features/income/IncomeTypeIcon'
import { Badge } from '@/components/ui/badge'
import { useActionToast } from '@/components/ui/ActionToast'
import type { FlowLedgerGroup, FlowLedgerRow } from '@/components/features/flow/FlowLedger'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { amountIsFiltered, ONE_TIME_INCOME, useExpenseFilterStore } from '@/lib/store/useExpenseFilterStore'
import { resolveRange, type ResolvedRange } from '@/lib/expenses/dateRange'
import { categoryChipColors } from '@/lib/expenses/categoryChip'
import { isNonSpendCategory } from '@/lib/constants/categoryMeta'
import { expenseAmountInBase } from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import { eventDaysLate } from '@/lib/utils/incomeOccurrences'
import { formatCurrency, formatFixed2, formatSigned } from '@/lib/utils/formatters'
import { shortDate } from '@/lib/utils/shortDate'
import { decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { usePendingSmsPreviews } from '@/hooks/usePendingSmsPreviews'
import { catalogCategory, merchantCategoryKey } from '@/lib/sms/merchantCategoryCache'
import { useIncomeResolution } from '@/components/features/flow/IncomePrompts'
import { useLocale, useT } from '@/lib/i18n'
import type { Expense, IncomeEvent, IncomeSource, IncomeSourceType, PaymentMethod } from '@/lib/store/types'

const REALIZED = new Set<IncomeEvent['status']>(['confirmed', 'late', 'partial'])
const CREDIT_KINDS = new Set(['income', 'refund', 'instant_transfer_in'])

/** One ledger entry before it becomes a row: enough to filter, total and group. */
export interface FlowItem {
  id: string
  dir: 'in' | 'out'
  /** Local `yyyy-MM-dd`. */
  date: string
  /** Base currency, gross (a refunded row keeps its struck original here). */
  amountBase: number
  /** Counts toward totals — refunded, declined, non-spend and pending do not. */
  counted: boolean
  /** Category (out) or income-type chip value (in). */
  facet: string
  methodId?: string
  row: FlowLedgerRow
}

/** Payment-method label as the ledger shows it: "Visa •• 4417". */
export function methodLabel(pm: PaymentMethod | undefined): string | null {
  if (!pm) return null
  return pm.last4 ? `${decomposePaymentMethodName(pm.name, pm.last4).provider} •• ${pm.last4}` : pm.name
}

function inRange(iso: string, { start, end }: ResolvedRange): boolean {
  const d = parseISO(iso.slice(0, 10))
  return d >= start && d <= end
}

/**
 * Flow's ledger for the current segment, range and filters: expenses, income (events plus
 * legacy one-time sources, de-duped by id — brief §8.2) and SMS captured offline, mapped onto
 * TransactionRow. Also returns the day groups and the pieces the band and count line need.
 */
export function useFlowLedger() {
  const t = useT()
  const { locale } = useLocale()
  const toast = useActionToast()
  const {
    expenses,
    incomeSources,
    incomeEvents,
    paymentMethods,
    settings,
    rates,
    deleteExpense,
    restoreExpense,
    deleteIncomeEvent,
    deleteIncomeSource,
  } = useFinanceStore(
    useShallow((s) => ({
      expenses: s.expenses,
      incomeSources: s.incomeSources,
      incomeEvents: s.incomeEvents,
      paymentMethods: s.paymentMethods,
      settings: s.settings,
      rates: s.exchangeRates,
      deleteExpense: s.deleteExpense,
      restoreExpense: s.restoreExpense,
      deleteIncomeEvent: s.deleteIncomeEvent,
      deleteIncomeSource: s.deleteIncomeSource,
    })),
  )
  const { monthFilter, setActiveModal, setEditingExpenseId, setEditingIncomeEventId, setEditingIncomeId, openAssignIncome } =
    useSettingsStore(
      useShallow((s) => ({
        monthFilter: s.monthFilter,
        setActiveModal: s.setActiveModal,
        setEditingExpenseId: s.setEditingExpenseId,
        setEditingIncomeEventId: s.setEditingIncomeEventId,
        setEditingIncomeId: s.setEditingIncomeId,
        openAssignIncome: s.openAssignIncome,
      })),
    )
  const filters = useExpenseFilterStore(
    useShallow((s) => ({
      segment: s.segment,
      cats: s.cats,
      methods: s.methods,
      incomeTypes: s.incomeTypes,
      amtMin: s.amtMin,
      amtMax: s.amtMax,
      range: s.range,
    })),
  )
  const previews = usePendingSmsPreviews()
  const { matches } = useIncomeResolution()
  const base = settings.baseCurrency
  const secondary = settings.showSecondaryCurrency ? settings.secondaryCurrency : undefined

  const resolved = useMemo(
    () => resolveRange(filters.range, monthFilter, settings.monthStartDay),
    [filters.range, monthFilter, settings.monthStartDay],
  )

  /** Every item in the range, before segment and filters. */
  const all = useMemo<FlowItem[]>(() => {
    const pmById = new Map(paymentMethods.map((m) => [m.id, m]))
    const sourceById = new Map(incomeSources.map((s) => [s.id, s]))
    const unmatched = new Set(matches.map((m) => m.event.id))
    const sub = (amountBase: number, sign: string) =>
      secondary ? `≈ ${sign}${formatCurrency(convertCurrency(amountBase, base, secondary, rates), secondary, true)}` : undefined
    const amountNode = (sign: string, v: number, struck: boolean) => (
      <>
        <span className={struck ? 'line-through' : undefined}>
          {sign}
          {formatFixed2(v)}
        </span>{' '}
        <span className="text-[11px] text-[var(--color-brand-text-muted)]">{base}</span>
      </>
    )
    const ink = (text: string) => <span className="font-semibold text-[var(--color-brand-primary-ink)]">{text}</span>
    const items: FlowItem[] = []

    for (const e of expenses) {
      const date = e.date.slice(0, 10)
      if (!inRange(date, resolved)) continue
      items.push(expenseItem(e, date))
    }

    function expenseItem(e: Expense, date: string): FlowItem {
      const colors = categoryChipColors(e.category)
      const gross = expenseAmountInBase(e, base, rates, true)
      const nonSpend = isNonSpendCategory(e.category)
      const dim = Boolean(e.refundKind)
      const statusDate = shortDate(e.refundedAt ?? e.date)
      const pmLabel = methodLabel(pmById.get(e.paymentMethodId)) ?? t.common.unknown
      return {
        id: e.id,
        dir: 'out',
        date,
        amountBase: gross,
        counted: !dim && !nonSpend,
        facet: e.category,
        methodId: e.paymentMethodId,
        row: {
          key: `x-${e.id}`,
          row: {
            icon: <CategoryIcon category={e.category} className="h-5 w-5" />,
            iconBg: colors.bg,
            iconFg: colors.fg,
            caption: e.category,
            captionColor: 'var(--color-brand-text-secondary)',
            dimmed: dim,
            onClick: () => {
              setEditingExpenseId(e.id)
              setActiveModal('editExpense')
            },
            title: e.description,
            titleBadge:
              e.refundKind === 'refunded' ? (
                <Badge variant="positive" size="xs" className="shrink-0">{t.expenses.badgeRefunded}</Badge>
              ) : e.refundKind === 'declined' ? (
                <Badge variant="muted" size="xs" className="shrink-0">{t.expenses.badgeDeclined}</Badge>
              ) : nonSpend ? (
                <CircleSlash role="img" aria-label={t.expenses.badgeNotCounted} className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand-text-muted)]" />
              ) : null,
            subtitle:
              e.refundKind === 'refunded' ? (
                <span className="font-semibold text-[var(--color-brand-green)]">{t.flow.returnedOn(statusDate)}</span>
              ) : e.refundKind === 'declined' ? (
                <span className="font-semibold">{t.flow.blockedNotCounted}</span>
              ) : (
                <span className="truncate">{pmLabel}</span>
              ),
            amount: amountNode('−', gross, dim),
            amountColor: dim || nonSpend ? 'var(--color-brand-text-muted)' : 'var(--color-brand-text-primary)',
            sub: dim ? undefined : sub(gross, '−'),
          },
          swipe: {
            deleteLabel: t.expenses.swipeDelete,
            onDelete: () => {
              deleteExpense(e.id)
              toast(t.expenses.expenseDeleted, { undo: () => restoreExpense(e), undoLabel: t.common.undo })
            },
          },
        },
      }
    }

    // Income: every event is one row, and a legacy one-time source only when no event
    // carries its id — the two representations must never both show (§8.2).
    const eventIds = new Set(incomeEvents.map((e) => e.id))
    type IncomeLike = {
      id: string
      name: string
      amount: number
      currency: string
      sourceType?: IncomeSourceType
      date: string
      paymentMethodId?: string
      template?: IncomeSource
      event?: IncomeEvent
      legacySourceId?: string
    }
    const incomes: IncomeLike[] = []
    for (const e of incomeEvents) {
      if (!REALIZED.has(e.status) || !inRange(e.receivedDate, resolved)) continue
      incomes.push({
        id: e.id,
        name: e.name,
        amount: e.amount,
        currency: e.currency,
        sourceType: e.sourceType,
        date: e.receivedDate.slice(0, 10),
        paymentMethodId: e.paymentMethodId,
        template: e.templateId ? sourceById.get(e.templateId) : undefined,
        event: e,
      })
    }
    for (const s of incomeSources) {
      if (s.isRecurring || eventIds.has(s.id) || !inRange(s.createdAt, resolved)) continue
      incomes.push({
        id: s.id,
        name: s.name,
        amount: s.amount,
        currency: s.currency,
        sourceType: s.sourceType,
        date: s.createdAt.slice(0, 10),
        paymentMethodId: s.paymentMethodId,
        legacySourceId: s.id,
      })
    }
    for (const inc of incomes) {
      const amountBase = convertCurrency(inc.amount, inc.currency, base, rates)
      const recurring = Boolean(inc.event?.templateId)
      const fromSms = Boolean(inc.event?.smsLogId)
      const daysLate = inc.event && recurring ? eventDaysLate(inc.event) : null
      const notLinked = Boolean(inc.event && unmatched.has(inc.event.id))
      const pmLabel = methodLabel(inc.paymentMethodId ? pmById.get(inc.paymentMethodId) : undefined)
      // §8.4/§8.5: only a payment method is a destination; never "Main account".
      const dest = pmLabel ? (
        <span className="truncate">→ {pmLabel}</span>
      ) : (
        <span className="truncate">
          {fromSms ? `${t.income.fromSms} · ` : ''}
          {ink(t.income.setAccount)}
        </span>
      )
      const open = inc.event
        ? () => {
            setEditingIncomeEventId(inc.event!.id)
            setActiveModal('editIncomeEvent')
          }
        : () => {
            setEditingIncomeId(inc.legacySourceId!)
            setActiveModal('editIncome')
          }
      const link = inc.event && !recurring ? () => openAssignIncome({ eventId: inc.event!.id }) : undefined
      items.push({
        id: inc.id,
        dir: 'in',
        date: inc.date,
        amountBase,
        counted: true,
        facet: recurring ? (inc.sourceType ?? 'other') : ONE_TIME_INCOME,
        methodId: inc.paymentMethodId,
        row: {
          key: `i-${inc.id}`,
          isIn: true,
          row: {
            icon: <IncomeTypeIcon type={inc.sourceType} className="h-5 w-5" />,
            iconBg: 'var(--color-brand-green-soft)',
            iconFg: 'var(--color-brand-green)',
            caption: recurring ? incomeSourceTypeLabel(t.income, inc.sourceType) : t.flow.oneTimeCaption,
            captionColor: 'var(--color-brand-green)',
            // A credit that is probably a payday opens the link sheet: linking needs a visible route.
            onClick: notLinked ? link : open,
            title: inc.name,
            titleBadge: daysLate ? (
              <Badge variant="warning" size="xs" className="shrink-0">{t.income.arrivedDaysLate(daysLate)}</Badge>
            ) : recurring ? (
              <Badge variant="brand" size="xs" className="shrink-0">{t.income.recurringLabel}</Badge>
            ) : notLinked ? (
              <Badge variant="muted" size="xs" className="shrink-0">{t.income.notLinked}</Badge>
            ) : (
              <Badge variant="muted" size="xs" className="shrink-0">{t.income.oneTimeLabel}</Badge>
            ),
            subtitle:
              daysLate && inc.event?.occurrenceDate ? (
                <span className="truncate">{t.income.paydayArrived(shortDate(inc.event.occurrenceDate), shortDate(inc.date))}</span>
              ) : notLinked ? (
                <span className="truncate">
                  {fromSms ? `${t.income.fromSms} · ` : ''}
                  {ink(t.income.linkToPayday)}
                </span>
              ) : (
                dest
              ),
            amount: amountNode('+', amountBase, false),
            amountColor: 'var(--color-brand-green)',
            sub: sub(amountBase, ''),
          },
          swipe: {
            deleteLabel: t.income.swipeDelete,
            onDelete: () => (inc.event ? deleteIncomeEvent(inc.event.id) : deleteIncomeSource(inc.legacySourceId!)),
            rightAction: link ? { label: t.addIncome.assignBtn, icon: <Link2 className="h-5 w-5" />, onAction: link } : undefined,
          },
        },
      })
    }

    // SMS captured offline: shown where they will land, muted and not counted, until they sync.
    // Their category is guessed offline, the way the server will: this user's own last
    // expense at the merchant, then the subscription catalog.
    const pastCategory = new Map<string, string>()
    for (const e of [...expenses].sort((a, b) => a.date.localeCompare(b.date))) {
      const k = merchantCategoryKey(e.description)
      if (k) pastCategory.set(k, e.category)
    }
    for (const p of previews) {
      const date = format(new Date(p.receivedAt), 'yyyy-MM-dd')
      if (!inRange(date, resolved)) continue
      const dir = p.parsed && CREDIT_KINDS.has(p.parsed.kind) ? 'in' : 'out'
      const amountBase = p.parsed ? convertCurrency(p.parsed.amount, p.parsed.currency, base, rates) : 0
      const who = p.parsed?.counterparty ?? null
      const category = dir === 'out' ? (pastCategory.get(merchantCategoryKey(who) ?? '') ?? catalogCategory(who) ?? null) : null
      const colors = category ? categoryChipColors(category) : null
      items.push({
        id: p.key,
        dir,
        date,
        amountBase,
        counted: false,
        facet: '',
        row: {
          key: `p-${p.key}`,
          row: {
            icon: category ? <CategoryIcon category={category} className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />,
            iconBg: colors?.bg,
            iconFg: colors?.fg ?? 'var(--color-brand-text-muted)',
            caption: category ?? undefined,
            captionColor: 'var(--color-brand-text-secondary)',
            dimmed: true,
            title: p.parsed ? p.parsed.counterparty || p.parsed.bank : t.pendingSms.generic,
            titleBadge: <Badge variant="muted" size="xs" className="shrink-0">{t.flow.pending}</Badge>,
            subtitle: <span className="truncate">{t.flow.capturedOffline}</span>,
            amount: p.parsed ? amountNode(dir === 'in' ? '+' : '−', amountBase, false) : '—',
            amountColor: 'var(--color-brand-text-muted)',
          },
        },
      })
    }
    return items
  }, [
    expenses, incomeEvents, incomeSources, paymentMethods, previews, matches, resolved, base, secondary, rates, t,
    setActiveModal, setEditingExpenseId, setEditingIncomeEventId, setEditingIncomeId, openAssignIncome,
    deleteExpense, restoreExpense, deleteIncomeEvent, deleteIncomeSource, toast,
  ])

  const amountOn = amountIsFiltered(filters.amtMin, filters.amtMax)
  const items = useMemo(
    () =>
      all
        .filter((i) => {
          if (filters.segment === 'in' && i.dir !== 'in') return false
          if (filters.segment === 'out' && i.dir !== 'out') return false
          if (filters.cats.length && (i.dir !== 'out' || !filters.cats.includes(i.facet))) return false
          if (filters.segment === 'in' && filters.incomeTypes.length && !filters.incomeTypes.includes(i.facet)) return false
          if (filters.methods.length && !filters.methods.includes(i.methodId ?? '')) return false
          if (amountOn && (i.amountBase < filters.amtMin || i.amountBase > filters.amtMax)) return false
          return true
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [all, filters, amountOn],
  )

  const groups = useMemo<FlowLedgerGroup[]>(() => {
    const now = new Date()
    const today = format(now, 'yyyy-MM-dd')
    const yesterday = format(subDays(now, 1), 'yyyy-MM-dd')
    const weekday = new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-US', { weekday: 'long' })
    const byDay = new Map<string, FlowItem[]>()
    for (const i of items) {
      const list = byDay.get(i.date)
      if (list) list.push(i)
      else byDay.set(i.date, [i])
    }
    return [...byDay.entries()].map(([day, list]) => {
      const net = list.filter((i) => i.counted).reduce((s, i) => s + (i.dir === 'in' ? i.amountBase : -i.amountBase), 0)
      return {
        key: day,
        label: day === today ? t.common.today : day === yesterday ? t.common.yesterday : weekday.format(parseISO(day)),
        date: shortDate(day),
        net: formatSigned(net, 2),
        rows: list.map((i) => i.row),
      }
    })
  }, [items, locale, t])

  return { all, items, groups, resolved }
}
