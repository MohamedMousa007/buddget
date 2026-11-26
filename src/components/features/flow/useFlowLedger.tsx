'use client'

import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { intlTag } from '@/lib/i18n/dateFormat'
import { localDayKey } from '@/lib/utils/localDate'
import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { format, parseISO, subDays } from 'date-fns'
import { CircleSlash, HandCoins, Link as LinkIcon, Link2, MessageSquare } from 'lucide-react'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { IncomeTypeIcon } from '@/components/features/income/IncomeTypeIcon'
import { Badge } from '@/components/ui/badge'
import { useLinkedDelete } from '@/hooks/useLinkedDelete'
import { useActionToast } from '@/components/ui/ActionToast'
import type { FlowLedgerGroup, FlowLedgerRow } from '@/components/features/flow/FlowLedger'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { amountInRange, amountIsFiltered, ONE_TIME_INCOME, useExpenseFilterStore } from '@/lib/store/useExpenseFilterStore'
import { resolveRange, type ResolvedRange } from '@/lib/expenses/dateRange'
import { categoryChipColors } from '@/lib/expenses/categoryChip'
import { isInternalMoveCategory, isNonSpendExpense } from '@/lib/constants/categoryMeta'
import { isCashOut } from '@/lib/accounts/cashOutRow'
import { expenseAmountInBase } from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import { eventDaysLate } from '@/lib/utils/incomeOccurrences'
import { formatCurrency, formatFlex, formatSignedAuto } from '@/lib/utils/formatters'
import { useShortDate } from '@/hooks/useShortDate'
import { decomposePaymentMethodName, methodDisplayName } from '@/lib/payment/paymentMethodDefaults'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { usePendingSmsPreviews } from '@/hooks/usePendingSmsPreviews'
import { catalogCategory, merchantCategoryKey } from '@/lib/sms/merchantCategoryCache'
import { useIncomeResolution } from '@/components/features/flow/IncomePrompts'
import { compareFlowItems, instantOf } from '@/components/features/flow/flowOrder'
import { useLocale, useT } from '@/lib/i18n'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import { monthHeads } from '@/lib/flow/ledgerMonths'
import { useWeekStart } from '@/hooks/useWeekStart'
import { smsAccountLabelKind } from '@/lib/accounts/unplacedSms'
import { storedMethodId } from '@/lib/accounts/resolve'
import { repaymentsReceived } from '@/lib/debts/repaymentsReceived'
import { isBorrowedMoney } from '@/lib/income/borrowed'
import { applyPassThrough, labelledPassThroughPairs, rememberedYesPairs } from '@/lib/spending/passThrough'
import { firstOpenFlag, type FlagRowKind } from '@/lib/sms/flagPrompts'
import type { SmsFlag } from '@/lib/sms/smsFlags'
import type { Expense, IncomeEvent, IncomeSource, IncomeSourceType, PaymentMethod } from '@/lib/store/types'

const REALIZED = new Set<IncomeEvent['status']>(['confirmed', 'late', 'partial'])
const CREDIT_KINDS = new Set(['income', 'refund', 'instant_transfer_in'])

/** One ledger entry before it becomes a row: enough to filter, total and group. */
export interface FlowItem {
  id: string
  dir: 'in' | 'out'
  /** Local `yyyy-MM-dd`. */
  date: string
  /** Epoch ms: orders rows inside a day. */
  at: number
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
export function methodLabel(pm: PaymentMethod | undefined, cashLabel?: string): string | null {
  if (!pm) return null
  const name = cashLabel ? methodDisplayName(pm, cashLabel) : pm.name
  return pm.last4 ? `${decomposePaymentMethodName(name, pm.last4).provider} •• ${pm.last4}` : name
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
  const shortDate = useShortDate()
  const t = useT()
  const lt = useFlowLtCopy()
  const { locale } = useLocale()
  const toast = useActionToast()
  const { removeExpense } = useLinkedDelete()
  const {
    expenses,
    incomeSources,
    incomeEvents,
    debts,
    debtPayments,
    paymentMethods,
    settings,
    rates,
    deleteIncomeEvent,
    deleteIncomeSource,
    restoreIncomeEvent,
    restoreIncomeSource,
  } = useFinanceStore(
    useShallow((s) => ({
      expenses: s.expenses,
      incomeSources: s.incomeSources,
      incomeEvents: s.incomeEvents,
      debts: s.debts,
      debtPayments: s.debtPayments,
      paymentMethods: s.paymentMethods,
      settings: s.settings,
      rates: s.exchangeRates,
      deleteIncomeEvent: s.deleteIncomeEvent,
      deleteIncomeSource: s.deleteIncomeSource,
      restoreIncomeEvent: s.restoreIncomeEvent,
      restoreIncomeSource: s.restoreIncomeSource,
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
  // Money that came in and went straight out. Unanswered: both legs carry a label and nothing changes. Answered
  // "yes" once: only pairs on one known account follow the remembered answer (with a toast); the rest are labelled
  // and counted. Answered "no": they are ordinary income and spending.
  const possiblePassThrough = useMemo(
    () => new Set(labelledPassThroughPairs(expenses, incomeEvents, settings.promptState).flatMap((p) => [p.expenseId, p.incomeId])),
    [expenses, incomeEvents, settings.promptState],
  )
  useEffect(() => {
    // Read fresh from the store: the flags this writes take the pairs out of the pending set, which is what stops a
    // second run (a re-render, a remount, strict mode) from applying or announcing them again.
    const { expenses: es, incomeEvents: is, settings: st } = useFinanceStore.getState()
    const pairs = rememberedYesPairs(es, is, st.promptState)
    if (pairs.length === 0) return
    const undo = applyPassThrough(pairs)
    toast(t.prompts.passThroughApplied(pairs.length), { undoLabel: t.common.undo, undo })
  }, [expenses, incomeEvents, settings.promptState, toast, t])
  const weekStart = useWeekStart()
  const base = settings.baseCurrency
  const secondary = settings.showSecondaryCurrency ? settings.secondaryCurrency : undefined

  const resolved = useMemo(
    () => resolveRange(filters.range, monthFilter, settings.monthStartDay, new Date(), weekStart),
    [filters.range, monthFilter, settings.monthStartDay, weekStart],
  )

  /** Every item in the range, before segment and filters. Own-account moves (ATM, transfer, top-up, exchange) are not
   *  listed in Flow at all, so they never count toward its empty states or category options; they stay in the ledger. */
  const all = useMemo<FlowItem[]>(() => {
    const pmById = new Map(paymentMethods.map((m) => [m.id, m]))
    const sourceById = new Map(incomeSources.map((s) => [s.id, s]))
    const unmatched = new Set(matches.map((m) => m.event.id))
    // Under the amount: the original amount when it was not in the base currency ("$9.99 USD"), else the ≈ second currency.
    const sub = (amountBase: number, sign: string, original?: { amount: number; currency: string }) => {
      if (original && original.currency !== base) {
        const text = formatCurrency(original.amount, original.currency, true)
        return text.includes(original.currency) ? text : `${text} ${original.currency}`
      }
      return secondary ? `≈ ${sign}${formatCurrency(convertCurrency(amountBase, base, secondary, rates), secondary, true)}` : undefined
    }
    const amountNode = (sign: string, v: number, struck: boolean) => (
      <>
        <span className={struck ? 'line-through' : undefined}>
          {sign}
          {formatFlex(v)}
        </span>{' '}
        <span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{base}</span>
      </>
    )
    const ink = (text: string) => <span className="font-semibold text-[var(--color-brand-primary-ink)]">{text}</span>
    const items: FlowItem[] = []
    const flagLabel: Record<SmsFlag, string> = {
      possible_duplicate: t.prompts.smsFlags.badgeDuplicate,
      date_unsure: t.prompts.smsFlags.badgeDate,
      refund_unmatched: t.prompts.smsFlags.badgeRefund,
      model_kind_unproven: t.prompts.smsFlags.badgeKind,
      cash_deposit: t.prompts.smsFlags.badgeCash,
      card_load: t.prompts.smsFlags.badgeCardLoad,
      wallet_unregistered: t.prompts.smsFlags.badgeWallet,
      topup_repaired: t.prompts.smsFlags.badgeTopup,
    }
    const openFlag = (row: { smsFlags?: string[]; smsFlagsAck?: string[] } | undefined, kind: FlagRowKind) => {
      const flag = row ? firstOpenFlag(row, kind) : null
      return flag ? <Badge variant="muted" size="xs" className="shrink-0">{flagLabel[flag]}</Badge> : null
    }

    for (const e of expenses) {
      const date = e.date.slice(0, 10)
      if (!inRange(date, resolved)) continue
      if (!e.refundKind && isInternalMoveCategory(e.category) && !isCashOut(e)) continue
      items.push(expenseItem(e, date))
    }

    function expenseItem(e: Expense, date: string): FlowItem {
      const colors = categoryChipColors(e.category)
      const gross = expenseAmountInBase(e, base, rates, Boolean(e.refundKind))
      const nonSpend = isNonSpendExpense(e)
      const dim = Boolean(e.refundKind)
      const statusDate = shortDate(e.refundedAt ?? e.date)
      const pmLabel = smsAccountLabelKind(e) === 'unassigned' ? t.common.unassigned : methodLabel(pmById.get(e.paymentMethodId), t.accountsPage.typeCash) ?? t.common.unknown
      return {
        id: e.id,
        dir: 'out',
        date,
        at: instantOf(e.occurredAt, date),
        amountBase: gross,
        counted: !dim && !nonSpend,
        // A cash-out row is a transfer, never a spending category, so it adds no category filter option.
        facet: isCashOut(e) ? '' : e.category,
        methodId: e.paymentMethodId,
        row: {
          key: `x-${e.id}`,
          row: {
            icon: <CategoryIcon category={e.category} className="h-5 w-5" />,
            iconBg: colors.bg,
            iconFg: colors.fg,
            dimmed: dim,
            onClick: () => {
              setEditingExpenseId(e.id)
              setActiveModal('editExpense')
            },
            title: e.description,
            titleBadge:
              openFlag(e, 'expense') ??
              (e.refundKind === 'refunded' ? (
                <Badge variant="positive" size="xs" className="shrink-0">{t.expenses.badgeRefunded}</Badge>
              ) : e.refundKind === 'declined' ? (
                <Badge variant="muted" size="xs" className="shrink-0">{t.expenses.badgeDeclined}</Badge>
              ) : e.refundedAmount ? (
                <Badge variant="positive" size="xs" className="shrink-0">{t.expenses.badgePartlyRefunded}</Badge>
              ) : e.spendExclusion === 'for_someone' ? (
                <Badge variant="muted" size="xs" className="shrink-0">{e.owedSettledAt ? t.exclusion.badgeRepaid : t.exclusion.badgeOwed(e.owedBy ?? t.exclusion.forSomeone)}</Badge>
              ) : e.categorySource === 'ai_suggested' ? (
                <Badge variant="muted" size="xs" className="shrink-0">{t.flow.suggestedCategory}</Badge>
              ) : possiblePassThrough.has(e.id) ? (
                <Badge variant="muted" size="xs" className="shrink-0">{t.flow.possiblePassThrough}</Badge>
              ) : nonSpend ? (
                <CircleSlash role="img" aria-label={t.expenses.badgeNotCounted} className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand-text-muted)]" />
              ) : e.linkedSubscriptionId ? (
                <LinkIcon role="img" aria-label={t.subscriptions.ui.chips.subscription} className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand-text-muted)]" />
              ) : null),
            subtitle:
              e.refundKind === 'refunded' ? (
                <span className="font-semibold text-[var(--color-brand-green)]">{t.flow.returnedOn(statusDate)}</span>
              ) : e.refundKind === 'declined' ? (
                <span className="font-semibold">{t.flow.blockedNotCounted}</span>
              ) : (
                <span className="truncate">{isCashOut(e) ? `${pmLabel} → ${methodLabel(pmById.get(e.toPaymentMethodId ?? ''), t.accountsPage.typeCash) ?? t.accountsPage.typeCash}` : `${categoryLabel(t, e.category)} · ${pmLabel}`}</span>
              ),
            amount: amountNode('−', gross, dim),
            amountColor: dim || nonSpend ? 'var(--color-brand-text-muted)' : 'var(--color-brand-text-primary)',
            sub: dim ? undefined : sub(gross, '−', e),
          },
          swipe: {
            deleteLabel: t.expenses.swipeDelete,
            onDelete: () => void removeExpense(e),
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
      at: number
      paymentMethodId?: string
      template?: IncomeSource
      event?: IncomeEvent
      legacySourceId?: string
      linkedDebtId?: string
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
        at: instantOf(e.occurredAt, e.receivedDate.slice(0, 10)),
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
        date: localDayKey(s.createdAt),
        at: Date.parse(s.createdAt),
        paymentMethodId: s.paymentMethodId,
        legacySourceId: s.id,
        linkedDebtId: s.linkedDebtId,
      })
    }
    for (const inc of incomes) {
      const amountBase = convertCurrency(inc.amount, inc.currency, base, rates)
      const recurring = Boolean(inc.event?.templateId)
      const fromSms = Boolean(inc.event?.smsLogId)
      const daysLate = inc.event && recurring ? eventDaysLate(inc.event) : null
      const notLinked = Boolean(inc.event && unmatched.has(inc.event.id))
      const passedThrough = inc.event?.exclusion === 'pass_through'
      const borrowed = isBorrowedMoney(inc.event ?? inc)
      const notIncome = Boolean(inc.event?.exclusion) || borrowed
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
        at: inc.at,
        amountBase,
        counted: !notIncome,
        facet: recurring ? (inc.sourceType ?? 'other') : ONE_TIME_INCOME,
        methodId: inc.paymentMethodId,
        row: {
          key: `i-${inc.id}`,
          isIn: true,
          row: {
            icon: <IncomeTypeIcon type={inc.sourceType} className="h-5 w-5" />,
            iconBg: 'var(--color-brand-green-soft)',
            iconFg: 'var(--color-brand-green)',
            // A credit that is probably a payday opens the link sheet: linking needs a visible route.
            onClick: notLinked ? link : open,
            title: inc.name,
            badgeWrap: borrowed,
            titleBadge: openFlag(inc.event, 'income') ?? (passedThrough ? (
              <Badge variant="muted" size="xs" className="shrink-0">{t.flow.passThrough}</Badge>
            ) : borrowed ? (
              <Badge variant="muted" size="xs" className="shrink-0">{t.flow.repaymentNotIncome}</Badge>
            ) : possiblePassThrough.has(inc.id) ? (
              <Badge variant="muted" size="xs" className="shrink-0">{t.flow.possiblePassThrough}</Badge>
            ) : daysLate ? (
              <Badge variant="warning" size="xs" className="shrink-0">{t.income.arrivedDaysLate(daysLate)}</Badge>
            ) : recurring ? (
              <Badge variant="brand" size="xs" className="shrink-0">{t.income.recurringLabel}</Badge>
            ) : notLinked ? (
              <Badge variant="muted" size="xs" className="shrink-0">{t.income.notLinked}</Badge>
            ) : (
              // One-time money names the type picked for it (Side hustle, Gift); "One-time" only when it has none.
              <Badge variant="muted" size="xs" className="shrink-0">
                {inc.sourceType && inc.sourceType !== 'other' ? incomeSourceTypeLabel(t.income, inc.sourceType) : t.income.oneTimeLabel}
              </Badge>
            )),
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
            amountColor: notIncome ? 'var(--color-brand-text-muted)' : 'var(--color-brand-green)',
            sub: sub(amountBase, '', inc),
          },
          swipe: {
            deleteLabel: t.income.swipeDelete,
            onDelete: () => {
              const { event, legacySourceId } = inc
              const legacy = legacySourceId ? incomeSources.find((s) => s.id === legacySourceId) : undefined
              if (event) deleteIncomeEvent(event.id)
              else deleteIncomeSource(legacySourceId!)
              toast(t.moneyFlows.incomeDeleted, {
                undo: () => {
                  if (event) {
                    if (!restoreIncomeEvent(event)) toast(t.moneyFlows.undoPocketSpent)
                  } else if (legacy) restoreIncomeSource(legacy)
                },
                undoLabel: t.common.undo,
              })
            },
            rightAction: link ? { label: t.addIncome.assignBtn, icon: <Link2 className="h-5 w-5" />, onAction: link } : undefined,
          },
        },
      })
    }

    // Money paid back on a debt owed to the user: money in, but not earned income, so it stays out of the totals (BUD-90).
    for (const r of repaymentsReceived(debts, debtPayments, (day) => inRange(day, resolved))) {
      const amountBase = convertCurrency(r.amount, r.currency, base, rates)
      const pmLabel = methodLabel(r.paymentMethodId ? pmById.get(r.paymentMethodId) : undefined)
      items.push({
        id: r.id,
        dir: 'in',
        date: r.date,
        at: instantOf(r.occurredAt, r.date),
        amountBase,
        counted: false,
        facet: 'repayment',
        methodId: r.paymentMethodId,
        row: {
          key: `r-${r.id}`,
          isIn: true,
          row: {
            icon: <HandCoins className="h-5 w-5" aria-hidden />,
            iconBg: 'var(--color-brand-green-soft)',
            iconFg: 'var(--color-brand-green)',
            title: t.flow.repaymentReceived(r.person),
            badgeWrap: true,
            titleBadge: <Badge variant="muted" size="xs" className="shrink-0">{t.flow.repaymentNotIncome}</Badge>,
            subtitle: pmLabel ? <span className="truncate">→ {pmLabel}</span> : undefined,
            amount: amountNode('+', amountBase, false),
            amountColor: 'var(--color-brand-green)',
            sub: sub(amountBase, ''),
          },
        },
      })
    }

    // SMS captured offline: shown where they will land, muted and not counted, until they sync.
    // Their category is guessed offline, the way the server will: this user's own last
    // expense at the merchant, then the subscription catalog.
    const pastCategory = new Map<string, string>()
    if (previews.length > 0) {
      for (const e of [...expenses].sort((a, b) => a.date.localeCompare(b.date))) {
        const k = merchantCategoryKey(e.description)
        if (k) pastCategory.set(k, e.category)
      }
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
        at: Date.parse(p.receivedAt),
        amountBase,
        counted: false,
        facet: '',
        row: {
          key: `p-${p.key}`,
          row: {
            icon: category ? <CategoryIcon category={category} className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />,
            iconBg: colors?.bg,
            iconFg: colors?.fg ?? 'var(--color-brand-text-muted)',
            dimmed: true,
            // Tapping a waiting message retries every waiting message now instead of waiting for the schedule.
            onClick: () => { void import('@/lib/native/smsTracker').then((m) => m.retrySmsNow()) },
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
    expenses, incomeEvents, incomeSources, debts, debtPayments, paymentMethods, previews, matches, resolved, base, secondary, rates, t, possiblePassThrough,
    setActiveModal, setEditingExpenseId, setEditingIncomeEventId, setEditingIncomeId, openAssignIncome,
    removeExpense, deleteIncomeEvent, deleteIncomeSource, restoreIncomeEvent, restoreIncomeSource, toast, shortDate,
  ])

  const amountOn = amountIsFiltered(filters.amtMin, filters.amtMax)
  const items = useMemo(
    () =>
      all
        .filter((i) => {
          if (filters.segment === 'in' && i.dir !== 'in') return false
          if (filters.segment === 'out' && i.dir !== 'out') return false
          // The segment filters first; a category then narrows spending (it never empties In).
          if (filters.segment !== 'in' && filters.cats.length && (i.dir !== 'out' || !filters.cats.includes(i.facet))) return false
          if (filters.segment === 'in' && filters.incomeTypes.length && !filters.incomeTypes.includes(i.facet)) return false
          if (filters.methods.length && !filters.methods.includes(storedMethodId(i.methodId ?? '', paymentMethods))) return false
          if (amountOn && !amountInRange(i.amountBase, filters.amtMin, filters.amtMax)) return false
          return true
        })
        .sort(compareFlowItems),
    [all, filters, amountOn, paymentMethods],
  )

  const groups = useMemo<FlowLedgerGroup[]>(() => {
    const now = new Date()
    const today = format(now, 'yyyy-MM-dd')
    const yesterday = format(subDays(now, 1), 'yyyy-MM-dd')
    const weekday = new Intl.DateTimeFormat(intlTag(locale), { weekday: 'long' })
    const byDay = new Map<string, FlowItem[]>()
    for (const i of items) {
      const list = byDay.get(i.date)
      if (list) list.push(i)
      else byDay.set(i.date, [i])
    }
    const days = [...byDay.entries()]
    const heads = monthHeads(days.map(([day, list]) => ({ day, rows: list.length })))
    const monthLabel = new Intl.DateTimeFormat(intlTag(locale), { month: 'long', year: 'numeric' })
    return days.map(([day, list], i) => {
      const net = list.filter((i) => i.counted).reduce((s, i) => s + (i.dir === 'in' ? i.amountBase : -i.amountBase), 0)
      const head = heads[i]
      return {
        key: day,
        label: day === today ? t.common.today : day === yesterday ? t.common.yesterday : weekday.format(parseISO(day)),
        date: shortDate(day),
        net: formatSignedAuto(net),
        monthHead: head ? { label: monthLabel.format(parseISO(`${head.month}-01`)), count: lt.page.monthCount(head.count) } : undefined,
        rows: list.map((i) => i.row),
      }
    })
  }, [items, locale, t, lt, shortDate])

  return { all, items, groups, resolved }
}
