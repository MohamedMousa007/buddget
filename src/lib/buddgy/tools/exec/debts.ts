import { defineTools } from '@/lib/buddgy/tools/define'
import { type Plan, reason } from '@/lib/buddgy/tools/exec/planKit'
import { settlesWithoutExpense } from '@/lib/debts/debtDirection'
import { debtLabels } from '@/lib/buddgy/tools/exec/debtsCopy'
import {
  debtChoice,
  debtTitle,
  fmtDebt,
  findDebt,
  isOpen,
  nextDue,
  parseDebtCurrency,
  remainingOf,
  round2,
  balanceCtx,
} from '@/lib/buddgy/tools/exec/debtsKit'
import { refOf, resolveByRefOrName, resolveRef } from '@/lib/buddgy/tools/refs'
import { methodField, resolveMethod } from '@/lib/buddgy/tools/exec/paymentMethodKit'
import { changedKeys, putBack, restoreRows, revertRows } from '@/lib/buddgy/tools/exec/restoreKit'
import { debtsSpecs } from '@/lib/buddgy/tools/specs/debts'
import { fin } from '@/lib/buddgy/tools/stores'
import type { ReadImpl, ToolContext, WriteImpl } from '@/lib/buddgy/tools/types'
import { fail, makeProposal, money, num, ok, parseIsoDate, text } from '@/lib/buddgy/tools/writeKit'
import { isBnplPlan } from '@/lib/debt/bnpl'
import { reconcileDebtSchedule } from '@/lib/debts/recurringDebtDueHandlers'
import { installmentPaymentsCompleted } from '@/lib/debts/installmentSchedule'
import { findInstallmentProviderMeta } from '@/lib/constants/installmentProviders'
import { composePaymentMethodName, PAYMENT_TYPE_META } from '@/lib/payment/paymentMethodDefaults'
import type {
  Currency,
  Debt,
  DebtCurrency,
  FinanceStore,
  GoldKarat,
  InstallmentProvider,
  PaymentMethod,
} from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import {
  calculateDebtRemainingInBaseCurrency,
  calculateDebtRemainingRaw,
  computeDebtPaymentRecord,
  isDebtFullyPaid,
  totalPaidTowardDebt,
} from '@/lib/utils/calculations'
import { computeCreditCardOutstanding, creditUtilizationRatio } from '@/lib/debt/computeCreditCardBalance'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { localTodayISO } from '@/lib/utils/localDate'

const LIST_CAP = 15
const PAYMENTS_SHOWN = 10
const NOTE_CAP = 80
const RECENT_MS = 2 * 60_000
const justAdded = (createdAt: string) => Date.now() - new Date(createdAt).getTime() < RECENT_MS
const KARATS: GoldKarat[] = [24, 22, 21, 18]
const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'annually'] as const
type Frequency = (typeof FREQUENCIES)[number]
const PROVIDERS = ['credit_card', 'tabby', 'tamara', 'other'] as const

const kindOf = (d: Debt) => d.debtType ?? 'general'
const dirOf = (d: Debt) => (d.direction === 'they_owe' ? 'they_owe' : 'i_owe')
const curOf = (d: Debt) => (d.isGold ? 'XAU' : d.currency)

const list_debts: ReadImpl = (args, ctx) => {
  const s = fin()
  const base = s.settings.baseCurrency
  const status = args.status === 'cleared' || args.status === 'all' ? args.status : 'open'
  const kind = typeof args.kind === 'string' ? args.kind : undefined
  const pool = s.debts.filter(
    (d) => (status === 'all' || (status === 'open' ? isOpen(d) : !isOpen(d))) && (!kind || kindOf(d) === kind),
  )
  const inBase = (d: Debt, remaining: number) =>
    calculateDebtRemainingInBaseCurrency(remaining, d, base, s.exchangeRates, s.goldPricePerGram, s.goldPriceAvailable)
  const rows = pool
    .map((d) => {
      const left = remainingOf(s, d)
      return { d, left, weight: inBase(d, left) }
    })
    .sort((a, b) => b.weight - a.weight)
  let owe = 0
  let owed = 0
  for (const r of rows) {
    if (!isOpen(r.d)) continue
    if (dirOf(r.d) === 'they_owe') owed += r.weight
    else owe += r.weight
  }

  return {
    currency: base,
    owe: Math.round(owe),
    owedToYou: Math.round(owed),
    count: rows.length,
    rows: rows.slice(0, LIST_CAP).map(({ d, left }) => {
      const who = d.personName || d.person
      const paymentsDone = d.debtType === 'installment' ? installmentPaymentsCompleted(d, s.debtPayments.filter((p) => p.debtId === d.id)) : 0
      return {
        ref: refOf(d.id),
        name: debtTitle(d),
        ...(who && who !== 'Installment' && who !== debtTitle(d) ? { person: who } : {}),
        dir: dirOf(d),
        kind: kindOf(d),
        left: round2(left),
        cur: curOf(d),
        ...(d.isGold && d.goldKarat ? { karat: d.goldKarat } : {}),
        ...(isOpen(d) ? {} : { status: 'cleared' }),
        ...(isOpen(d) ? { due: nextDue(s, d, ctx.now) } : {}),
        ...(d.debtType === 'installment' && d.installmentAmount ? { each: d.installmentAmount, paymentsLeft: (d.installmentCount ?? 0) - paymentsDone } : {}),
        ...(d.debtType === 'credit_card' && d.creditLimit ? { limit: d.creditLimit } : {}),
      }
    }),
    ...(rows.length > LIST_CAP ? { more: rows.length - LIST_CAP } : {}),
  }
}

const get_debt: ReadImpl = (args, ctx) => {
  const s = fin()
  const found = findDebt(s, args.debt)
  if (found.error) return found.error
  const d = found.debt
  const ctxBal = balanceCtx(s)
  const payments = s.debtPayments.filter((p) => p.debtId === d.id).sort((a, b) => b.date.localeCompare(a.date))
  const left = remainingOf(s, d)
  const schedule = s.recurringDebtPayments.find((r) => r.debtId === d.id && r.isActive)
  const outstanding = d.debtType === 'credit_card' ? computeCreditCardOutstanding(d, s.expenses, s.debtPayments, s.exchangeRates) : undefined
  const util = outstanding !== undefined ? creditUtilizationRatio(outstanding, d.creditLimit) : null
  return {
    ref: refOf(d.id),
    name: debtTitle(d),
    person: d.personName || d.person || undefined,
    dir: dirOf(d),
    kind: kindOf(d),
    status: isOpen(d) ? 'open' : 'cleared',
    total: d.startingBalance,
    paid: round2(totalPaidTowardDebt(d.id, s.debtPayments)),
    left: round2(left),
    cur: curOf(d),
    due: isOpen(d) ? nextDue(s, d, ctx.now) : undefined,
    ...(schedule ? { reminder: { amount: schedule.amount, cur: schedule.currency, every: schedule.frequency, next: schedule.nextDueDate } } : {}),
    ...(d.debtType === 'installment'
      ? { each: d.installmentAmount, count: d.installmentCount, every: d.installmentFrequency, first: d.startDate, provider: d.installmentProviderName ?? d.installmentProvider }
      : {}),
    ...(d.debtType === 'credit_card'
      ? { limit: d.creditLimit, dueDay: d.paymentDueDay, graceDays: d.gracePeriodDays, minPercent: d.minimumPaymentPercent, usedPct: util === null ? undefined : Math.round(util * 100) }
      : {}),
    ...(d.notes ? { notes: text(d.notes, NOTE_CAP) } : {}),
    fullyPaid: isDebtFullyPaid(d, s.debtPayments, ctxBal),
    payments: payments.slice(0, PAYMENTS_SHOWN).map((p) => ({
      ref: refOf(p.id),
      date: p.date.slice(0, 10),
      amount: round2(p.originalAmount ?? p.amountPaid),
      cur: p.originalAmount !== undefined ? (p.paymentCurrency ?? curOf(d)) : curOf(d),
      ...(p.fundedFromSavings ? { fromSavings: true } : {}),
    })),
    ...(payments.length > PAYMENTS_SHOWN ? { more: payments.length - PAYMENTS_SHOWN } : {}),
  }
}

type PersonalArgs = {
  name: string
  person: string
  direction: 'i_owe' | 'they_owe'
  amount: number
  currency: DebtCurrency
  karat?: GoldKarat
  relationship?: string
}

function parsePersonal(s: FinanceStore, args: Record<string, unknown>): Plan<{ parsed: PersonalArgs }> {
  const name = text(args.name, 80)
  const person = text(args.person, 60)
  if (!name) return { error: fail('A debt needs a name, such as what it is for.') }
  if (!person) return { error: fail('Say who the debt is with.') }
  if (args.direction !== 'i_owe' && args.direction !== 'they_owe') {
    return { error: fail('Say whether the user owes them or they owe the user.', 'Ask the user; do not guess the direction.') }
  }
  const amount = num(args.amount)
  if (amount === undefined || amount <= 0) return { error: fail('The amount must be above zero.') }
  const cur = parseDebtCurrency(s, args.currency, true)
  if (cur.error) return cur
  let karat: GoldKarat | undefined
  if (cur.currency === 'XAU') {
    const k = args.karat === undefined ? 24 : num(args.karat)
    if (!KARATS.includes(k as GoldKarat)) return { error: fail('Gold karat must be 24, 22, 21 or 18.') }
    karat = k as GoldKarat
  }
  const parsed: PersonalArgs = {
    name,
    person,
    direction: args.direction,
    amount,
    currency: cur.currency,
    ...(karat ? { karat } : {}),
    ...(text(args.relationship, 40) ? { relationship: text(args.relationship, 40) } : {}),
  }
  return { parsed }
}

const add_debt: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = debtLabels(ctx.locale)
    const r = parsePersonal(s, args)
    if (r.error) return r.error
    const a = r.parsed
    const duplicate = s.debts.some(
      (d) =>
        isOpen(d) &&
        d.debtType === 'personal' &&
        d.name.toLowerCase() === a.name.toLowerCase() &&
        (d.personName ?? d.person).toLowerCase() === a.person.toLowerCase() &&
        d.startingBalance === a.amount &&
        dirOf(d) === a.direction,
    )
    const shown = a.currency === 'XAU' ? `${a.amount} g` : money(a.amount, a.currency)
    return ok(
      makeProposal({
        tool: 'add_debt',
        args: a,
        risk: 'approve',
        summary: `Pending approval: add debt ${a.name} with ${a.person}, ${shown}.`,
        preview: {
          domain: 'debts',
          tone: 'add',
          title: L.addDebt,
          rows: [
            { label: L.name, value: a.name },
            { label: L.person, value: a.person },
            { label: L.direction, value: a.direction === 'i_owe' ? L.iOwe : L.theyOwe },
            { label: L.amount, value: shown },
            ...(a.karat ? [{ label: L.karat, value: L.gold(a.karat) }] : []),
            ...(a.relationship ? [{ label: L.relationship, value: a.relationship }] : []),
          ],
          fields: [
            { key: 'name', label: L.name, kind: 'text', value: a.name },
            { key: 'person', label: L.person, kind: 'text', value: a.person },
            { key: 'amount', label: L.amount, kind: 'amount', value: String(a.amount), currency: a.currency },
            {
              key: 'direction',
              label: L.direction,
              kind: 'select',
              value: a.direction,
              options: [
                { value: 'i_owe', label: L.iOwe },
                { value: 'they_owe', label: L.theyOwe },
              ],
            },
          ],
          ...(duplicate ? { effect: L.duplicate } : {}),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = add_debt.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const a = again.proposal.args as unknown as PersonalArgs
    const twin = fin().debts.some(
      (d) =>
        justAdded(d.createdAt) &&
        d.debtType === 'personal' &&
        d.name.toLowerCase() === a.name.toLowerCase() &&
        (d.personName ?? d.person).toLowerCase() === a.person.toLowerCase() &&
        d.startingBalance === a.amount &&
        dirOf(d) === a.direction,
    )
    if (twin) return { ok: false, error: 'Already added' }
    const isGold = a.currency === 'XAU'
    const id = fin().addDebt({
      name: a.name,
      person: a.person,
      personName: a.person,
      description: undefined,
      startingBalance: a.amount,
      currency: a.currency,
      isGold,
      goldKarat: a.karat,
      notes: undefined,
      debtType: 'personal',
      emoji: isGold ? '🪙' : '💳',
      status: 'active',
      receivedVia: isGold ? 'gold' : 'cash',
      relationship: a.relationship,
      direction: a.direction,
    })
    return { ok: true, message: a.name, undo: () => fin().deleteDebt(id) }
  },
}

type PlanArgs = {
  item: string
  total: number
  count: number
  currency: DebtCurrency
  startDate: string
  frequency: Frequency
  provider: InstallmentProvider
  providerName?: string
  card?: string
}

function parsePlan(s: FinanceStore, args: Record<string, unknown>, ctx: ToolContext): Plan<{ parsed: PlanArgs }> {
  const item = text(args.item, 80)
  if (!item) return { error: fail('A plan needs an item name.') }
  const total = num(args.total)
  if (total === undefined || total <= 0) return { error: fail('The total must be above zero.') }
  const count = num(args.count)
  if (count === undefined || !Number.isInteger(count) || count < 1 || count > 360) {
    return { error: fail('The number of installments must be a whole number from 1 to 360.') }
  }
  const cur = parseDebtCurrency(s, args.currency, false)
  if (cur.error) return cur
  const startDate = args.startDate === undefined ? localTodayISO(ctx.now) : parseIsoDate(args.startDate)
  if (!startDate) return { error: fail('The start date must be a real date like 2026-10-19.') }
  const frequency = args.frequency === undefined ? 'monthly' : (FREQUENCIES as readonly unknown[]).includes(args.frequency) ? (args.frequency as Frequency) : null
  if (!frequency) return { error: fail('Frequency must be weekly, monthly, quarterly or annually.') }
  const provider = args.provider === undefined ? 'other' : (PROVIDERS as readonly unknown[]).includes(args.provider) ? (args.provider as InstallmentProvider) : null
  if (!provider) return { error: fail('Provider must be credit_card, tabby, tamara or other.') }
  let card: string | undefined
  if (provider === 'credit_card') {
    const cards = s.debts.filter((d) => d.debtType === 'credit_card')
    const hit = resolveByRefOrName(cards, args.card, (d) => d.name)
    if (hit.kind !== 'one') {
      return {
        error: fail(
          cards.length === 0 ? 'There is no credit card to link. Add the card first.' : 'Which credit card is this plan on?',
          'A credit-card plan must name its card.',
          (hit.kind === 'many' ? hit.items : cards).map(debtChoice),
        ),
      }
    }
    card = refOf(hit.item.id)
  }
  const parsed: PlanArgs = {
    item,
    total,
    count,
    currency: cur.currency,
    startDate,
    frequency,
    provider,
    ...(text(args.providerName, 40) ? { providerName: text(args.providerName, 40) } : {}),
    ...(card ? { card } : {}),
  }
  return { parsed }
}

const add_installment_plan: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = debtLabels(ctx.locale)
    const r = parsePlan(s, args, ctx)
    if (r.error) return r.error
    const a = r.parsed
    const each = round2(a.total / a.count)
    const cardDebt = a.card ? resolveRef(s.debts, a.card) : null
    const duplicate = s.debts.some((d) => isOpen(d) && d.debtType === 'installment' && d.name.toLowerCase() === a.item.toLowerCase() && d.startingBalance === a.total)
    const providerLabel = a.providerName ?? findInstallmentProviderMeta(a.provider)?.name ?? a.provider
    return ok(
      makeProposal({
        tool: 'add_installment_plan',
        args: a,
        risk: 'approve',
        summary: `Pending approval: add plan ${a.item}, ${money(a.total, a.currency)} over ${a.count} payments.`,
        preview: {
          domain: 'debts',
          tone: 'add',
          title: L.addInstallment,
          rows: [
            { label: L.item, value: a.item },
            { label: L.total, value: money(a.total, a.currency) },
            { label: L.count, value: String(a.count) },
            { label: L.perInstallment, value: money(each, a.currency) },
            { label: L.frequency, value: L.frequencies[a.frequency] },
            { label: L.startDate, value: a.startDate },
            { label: L.provider, value: providerLabel },
            ...(cardDebt?.kind === 'one' ? [{ label: L.linkedCard, value: debtTitle(cardDebt.item) }] : []),
          ],
          fields: [
            { key: 'item', label: L.item, kind: 'text', value: a.item },
            { key: 'total', label: L.total, kind: 'amount', value: String(a.total), currency: a.currency },
            { key: 'count', label: L.count, kind: 'text', value: String(a.count) },
            { key: 'startDate', label: L.startDate, kind: 'date', value: a.startDate },
          ],
          ...(duplicate ? { effect: L.duplicate } : {}),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = add_installment_plan.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const a = again.proposal.args as unknown as PlanArgs
    const s = fin()
    const twin = s.debts.some((d) => justAdded(d.createdAt) && d.debtType === 'installment' && d.name.toLowerCase() === a.item.toLowerCase() && d.startingBalance === a.total)
    if (twin) return { ok: false, error: 'Already added' }
    const card = a.card ? resolveRef(s.debts, a.card) : null
    const id = s.addDebt({
      name: a.item,
      person: 'Installment',
      description: undefined,
      startingBalance: a.total,
      currency: a.currency,
      isGold: false,
      notes: undefined,
      debtType: 'installment',
      emoji: '💳',
      status: 'active',
      receivedVia: 'cash',
      installmentCount: a.count,
      installmentFrequency: a.frequency,
      startDate: a.startDate,
      installmentAmount: round2(a.total / a.count),
      installmentProvider: a.provider,
      installmentProviderName: a.providerName ?? findInstallmentProviderMeta(a.provider)?.name,
      ...(card?.kind === 'one' ? { linkedCreditCardDebtId: card.item.id } : {}),
    })
    return { ok: true, message: a.item, undo: () => fin().deleteDebt(id) }
  },
}

type CardArgs = {
  name: string
  last4?: string
  outstanding: number
  limit?: number
  dueDay?: number
  graceDays: number
  minPercent: number
  currency: Currency
}

function parseCard(s: FinanceStore, args: Record<string, unknown>): Plan<{ parsed: CardArgs }> {
  const name = text(args.name, 60)
  if (!name) return { error: fail('A card needs a bank or card name.') }
  const last4 = text(args.last4, 8)
  if (last4 !== undefined && !/^\d{4}$/.test(last4)) return { error: fail('last4 must be exactly four digits.') }
  const outstanding = args.outstanding === undefined ? 0 : num(args.outstanding)
  if (outstanding === undefined || outstanding < 0) return { error: fail('The balance cannot be negative.') }
  const limit = args.limit === undefined ? undefined : num(args.limit)
  if (args.limit !== undefined && (limit === undefined || limit <= 0)) return { error: fail('The credit limit must be above zero.') }
  const dueDay = args.dueDay === undefined ? undefined : num(args.dueDay)
  if (args.dueDay !== undefined && (dueDay === undefined || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
    return { error: fail('The due day must be a whole number from 1 to 31.') }
  }
  const graceDays = args.graceDays === undefined ? 55 : num(args.graceDays)
  if (graceDays === undefined || !Number.isInteger(graceDays) || graceDays < 0 || graceDays > 120) return { error: fail('Grace days must be from 0 to 120.') }
  const minPercent = args.minPercent === undefined ? 5 : num(args.minPercent)
  if (minPercent === undefined || minPercent < 0 || minPercent > 100) return { error: fail('The minimum payment percent must be from 0 to 100.') }
  const cur = parseDebtCurrency(s, args.currency, false)
  if (cur.error) return cur
  const parsed: CardArgs = {
    name,
    outstanding,
    graceDays,
    minPercent,
    currency: cur.currency as Currency,
    ...(last4 ? { last4 } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(dueDay !== undefined ? { dueDay } : {}),
  }
  return { parsed }
}

const add_credit_card: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = debtLabels(ctx.locale)
    const r = parseCard(s, args)
    if (r.error) return r.error
    const a = r.parsed
    const fullName = composePaymentMethodName(a.name, { last4: a.last4 })
    const existing = s.paymentMethods.find(
      (m) => m.type === 'credit_card' && (m.name.toLowerCase() === fullName.toLowerCase() || (!!a.last4 && m.last4 === a.last4)),
    )
    if (existing) {
      return fail(`A credit card "${existing.name}" already exists.`, 'Use update_debt on it instead.', [
        ...s.debts.filter((d) => d.linkedPaymentMethodId === existing.id).map(debtChoice),
      ])
    }
    return ok(
      makeProposal({
        tool: 'add_credit_card',
        args: a,
        risk: 'approve',
        summary: `Pending approval: add credit card ${fullName}.`,
        preview: {
          domain: 'debts',
          tone: 'add',
          title: L.addCard,
          rows: [
            { label: L.name, value: fullName },
            { label: L.outstanding, value: money(a.outstanding, a.currency) },
            ...(a.limit !== undefined ? [{ label: L.limit, value: money(a.limit, a.currency) }] : []),
            ...(a.dueDay !== undefined ? [{ label: L.dueDay, value: String(a.dueDay) }] : []),
            { label: L.graceDays, value: String(a.graceDays) },
            { label: L.minPercent, value: `${a.minPercent}%` },
          ],
          fields: [
            { key: 'name', label: L.name, kind: 'text', value: a.name },
            { key: 'outstanding', label: L.outstanding, kind: 'amount', value: String(a.outstanding), currency: a.currency },
            ...(a.limit !== undefined ? [{ key: 'limit', label: L.limit, kind: 'amount' as const, value: String(a.limit), currency: a.currency }] : []),
          ],
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = add_credit_card.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const a = again.proposal.args as unknown as CardArgs
    const s = fin()
    const fullName = composePaymentMethodName(a.name, { last4: a.last4 })
    const pm: Omit<PaymentMethod, 'id'> = {
      name: fullName,
      type: 'credit_card',
      currency: a.currency,
      color: PAYMENT_TYPE_META.credit_card.color,
      isDefault: false,
      ...(a.last4 ? { last4: a.last4 } : {}),
    }
    const pmId = s.addPaymentMethod(pm)
    const debt = fin().debts.find((d) => d.debtType === 'credit_card' && d.linkedPaymentMethodId === pmId)
    if (!debt) return { ok: false, error: 'The card could not be created.' }
    fin().updateDebt(debt.id, {
      creditLimit: a.limit,
      startingBalance: a.outstanding,
      paymentDueDay: a.dueDay,
      gracePeriodDays: a.graceDays,
      minimumPaymentPercent: a.minPercent,
    })
    return {
      ok: true,
      message: fullName,
      undo: () =>
        useFinanceStore.setState((st) => ({
          debts: st.debts.filter((d) => d.id !== debt.id),
          paymentMethods: st.paymentMethods.filter((m) => m.id !== pmId),
        })),
    }
  },
}

function planPayment(args: Record<string, unknown>, ctx: ToolContext) {
  const s = fin()
  const found = findDebt(s, args.debt)
  if (found.error) return { error: found.error }
  const debt = found.debt
  const ledger = balanceCtx(s)
  if (isDebtFullyPaid(debt, s.debtPayments, ledger)) return { error: fail('That debt is already fully paid.') }
  const amount = num(args.amount)
  if (amount === undefined || amount <= 0) return { error: fail('The amount must be above zero.') }
  const base = s.settings.baseCurrency
  const wanted = text(args.currency, 8)?.toUpperCase()
  const payCur = wanted ?? (debt.isGold ? base : debt.currency)
  if (payCur === 'XAU' ? !debt.isGold : clampFiatToAllowed(s.settings, payCur as Currency) !== payCur) {
    return { error: fail(`${payCur} cannot be used for this payment.`, 'Use the debt currency or the base currency.') }
  }
  if (debt.isGold && payCur !== 'XAU' && !s.goldPriceAvailable) {
    return { error: fail('The gold price is not available right now.', 'Pay this debt in grams (currency XAU).') }
  }
  const date = args.date === undefined ? localTodayISO(ctx.now) : parseIsoDate(args.date)
  if (!date) return { error: fail('The date must be a real date like 2026-10-19.') }
  const method = resolveMethod(s, args.method)
  if (method.error) return { error: method.error }
  const computed = computeDebtPaymentRecord(debt, amount, payCur, base, s.exchangeRates, s.goldPricePerGram, s.debtPayments, ledger)
  if (!computed.ok) return { error: fail(computed.error) }
  const remaining = calculateDebtRemainingRaw(debt, s.debtPayments, ledger)
  const after = Math.max(0, remaining - computed.amountInDebtUnit)
  const clears = debt.debtType !== 'credit_card' && after <= 1e-6
  const notes = text(args.notes, 200)
  return { s, debt, amount, payCur, date, pmId: method.id, computed, after, clears, notes }
}

const record_debt_payment: WriteImpl = {
  propose(args, ctx) {
    const p = planPayment(args, ctx)
    if (p.error) return p.error
    const L = debtLabels(ctx.locale)
    const { s, debt, amount, payCur, date, pmId, computed, after, clears, notes } = p
    const shown = payCur === 'XAU' ? `${amount} g` : money(amount, payCur)
    const methodName = s.paymentMethods.find((m) => m.id === pmId)?.name
    const received = dirOf(debt) === 'they_owe'
    const converted = payCur !== (debt.isGold ? 'XAU' : debt.currency)
    return ok(
      makeProposal({
        tool: 'record_debt_payment',
        args: { debt: refOf(debt.id), amount, currency: payCur, date, method: pmId ? refOf(pmId) : undefined, notes },
        risk: 'approve',
        summary: `Pending approval: pay ${shown} toward ${debtTitle(debt)}${clears ? ', which clears it' : ''}.`,
        preview: {
          domain: 'debts',
          tone: 'change',
          title: `${L.payDebt}: ${debtTitle(debt)}`,
          rows: [
            { label: L.amount, value: shown },
            ...(converted ? [{ label: L.paid, value: fmtDebt(computed.amountInDebtUnit, debt) }] : []),
            { label: L.date, value: date },
            ...(methodName ? [{ label: L.method, value: methodName }] : []),
            { label: L.remaining, value: fmtDebt(after, debt), before: fmtDebt(after + computed.amountInDebtUnit, debt) },
            ...(notes ? [{ label: L.notes, value: notes }] : []),
          ],
          fields: [
            { key: 'amount', label: L.amount, kind: 'amount', value: String(amount), currency: payCur },
            { key: 'date', label: L.date, kind: 'date', value: date },
            methodField(s, pmId, L.method),
          ],
          effect: [clears ? L.willClear : '', received ? L.noExpense : ''].filter(Boolean).join(' ') || undefined,
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const p = planPayment(proposal.args, ctx)
    if (p.error) return { ok: false, error: reason(p.error) }
    const { s, debt, amount, payCur, date, pmId, computed, notes } = p
    const { debts: debtsBefore, recurringDebtPayments: schedulesBefore, goals: goalsBefore } = s
    const paymentsBefore = new Set(s.debtPayments.map((x) => x.id))
    const expensesBefore = new Set(s.expenses.map((x) => x.id))

    const record = {
      debtId: debt.id,
      date,
      amountPaid: computed.amountInDebtUnit,
      paymentMethodId: pmId,
      paymentCurrency: payCur,
      originalAmount: amount,
      amountInPrimary: computed.amountInBase,
      rateAtEntry: computed.rateAtEntry,
      notes,
    }
    if (settlesWithoutExpense(debt)) {
      s.addDebtPayment(record)
    } else {
      const bnpl = isBnplPlan(debt, s.paymentMethods)
      s.addDebtPaymentWithExpense(record, {
        date,
        description: `${debt.name} — ${bnpl ? 'installment' : 'debt payment'}`,
        category: bnpl ? 'Installment' : 'Debt',
        amount,
        currency: payCur as Currency,
        paymentMethodId: pmId,
        isRecurring: false,
        notes,
        linkedDebtId: debt.id,
        isDebtPayment: true,
      })
    }
    reconcileDebtSchedule(debt.id, { amount, currency: payCur })

    const now = fin()
    const addedPayments = new Set(now.debtPayments.filter((x) => !paymentsBefore.has(x.id)).map((x) => x.id))
    const addedExpenses = new Set(now.expenses.filter((x) => !expensesBefore.has(x.id)).map((x) => x.id))
    const shown = payCur === 'XAU' ? `${amount} g` : money(amount, payCur)
    const { debts: debtsAfter, recurringDebtPayments: schedulesAfter, goals: goalsAfter } = now
    return {
      ok: true,
      message: `${debtTitle(debt)} · ${shown}`,
      undo: () =>
        useFinanceStore.setState((st) => ({
          debtPayments: st.debtPayments.filter((x) => !addedPayments.has(x.id)),
          expenses: st.expenses.filter((x) => !addedExpenses.has(x.id)),
          debts: revertRows(st.debts, debtsBefore, debtsAfter, changedKeys(debtsBefore, debtsAfter), true),
          recurringDebtPayments: revertRows(st.recurringDebtPayments, schedulesBefore, schedulesAfter, changedKeys(schedulesBefore, schedulesAfter)),
          goals: revertRows(st.goals, goalsBefore, goalsAfter, changedKeys(goalsBefore, goalsAfter), true),
        })),
    }
  },
}

type DebtPatch = Partial<Debt>

function planUpdate(args: Record<string, unknown>, ctx: ToolContext) {
  const s = fin()
  const L = debtLabels(ctx.locale)
  const found = findDebt(s, args.debt)
  if (found.error) return { error: found.error }
  const d = found.debt
  if (!isOpen(d)) return { error: fail('That debt is cleared and cannot be edited.') }
  const isCard = d.debtType === 'credit_card'
  const isPlan = d.debtType === 'installment'
  const patch: DebtPatch = {}
  const rows: { label: string; value: string; before: string }[] = []
  const set = <K extends keyof Debt>(key: K, value: Debt[K], label: string, show: (v: Debt[K]) => string) => {
    if (value === d[key]) return
    patch[key] = value
    rows.push({ label, before: d[key] === undefined ? '—' : show(d[key]), value: show(value) })
  }
  const asText = (v: unknown) => String(v ?? '—')

  if (args.name !== undefined) {
    const name = text(args.name, 80)
    if (!name) return { error: fail('The name cannot be empty.') }
    if (isCard) return { error: fail('A card is renamed from its payment method.') }
    set('name', name, isPlan ? L.item : L.name, asText)
  }
  if (args.person !== undefined) {
    const person = text(args.person, 60)
    if (!person) return { error: fail('The person cannot be empty.') }
    if (isCard || isPlan) return { error: fail('This kind of debt has no person.') }
    set('person', person, L.person, asText)
    if (d.debtType === 'personal') set('personName', person, L.person, asText)
  }
  let total = d.startingBalance
  if (args.amount !== undefined) {
    const n = num(args.amount)
    if (n === undefined || n < 0 || (n === 0 && !isCard)) return { error: fail('The amount must be above zero.') }
    if (!isCard && n < totalPaidTowardDebt(d.id, s.debtPayments)) {
      return { error: fail('That is less than what has already been paid.', 'The total cannot drop below the payments recorded.') }
    }
    total = n
    set('startingBalance', n, isCard ? L.outstanding : L.total, (v) => fmtDebt(Number(v), d))
  }
  let count = d.installmentCount
  if (args.count !== undefined) {
    if (!isPlan) return { error: fail('Only installment plans have a payment count.') }
    const n = num(args.count)
    if (n === undefined || !Number.isInteger(n) || n < 1 || n > 360) return { error: fail('The count must be a whole number from 1 to 360.') }
    count = n
    set('installmentCount', n, L.count, asText)
  }
  if (isPlan && (patch.startingBalance !== undefined || patch.installmentCount !== undefined)) {
    set('installmentAmount', round2(total / (count ?? 1)), L.perInstallment, (v) => fmtDebt(Number(v), d))
  }
  if (args.startDate !== undefined) {
    if (!isPlan) return { error: fail('Only installment plans have a start date.') }
    const date = parseIsoDate(args.startDate)
    if (!date) return { error: fail('The start date must be a real date like 2026-10-19.') }
    set('startDate', date, L.startDate, asText)
  }
  const cardOnly = (key: string) => (isCard ? null : fail(`${key} only applies to credit cards.`))
  if (args.limit !== undefined) {
    const e = cardOnly('limit')
    if (e) return { error: e }
    const n = num(args.limit)
    if (n === undefined || n <= 0) return { error: fail('The credit limit must be above zero.') }
    set('creditLimit', n, L.limit, (v) => fmtDebt(Number(v), d))
  }
  if (args.dueDay !== undefined) {
    const e = cardOnly('dueDay')
    if (e) return { error: e }
    const n = num(args.dueDay)
    if (n === undefined || !Number.isInteger(n) || n < 1 || n > 31) return { error: fail('The due day must be a whole number from 1 to 31.') }
    set('paymentDueDay', n, L.dueDay, asText)
  }
  if (args.graceDays !== undefined) {
    const e = cardOnly('graceDays')
    if (e) return { error: e }
    const n = num(args.graceDays)
    if (n === undefined || !Number.isInteger(n) || n < 0 || n > 120) return { error: fail('Grace days must be from 0 to 120.') }
    set('gracePeriodDays', n, L.graceDays, asText)
  }
  if (args.minPercent !== undefined) {
    const e = cardOnly('minPercent')
    if (e) return { error: e }
    const n = num(args.minPercent)
    if (n === undefined || n < 0 || n > 100) return { error: fail('The minimum payment percent must be from 0 to 100.') }
    set('minimumPaymentPercent', n, L.minPercent, (v) => `${v}%`)
  }
  if (args.notes !== undefined) {
    const notes = text(args.notes, 300)
    if (notes !== (d.notes ?? undefined)) {
      patch.notes = notes
      rows.push({ label: L.notes, before: d.notes ?? '—', value: notes ?? '—' })
    }
  }
  if (rows.length === 0) return { error: fail('Nothing would change.') }
  return { d, patch, rows, L }
}

const update_debt: WriteImpl = {
  propose(args, ctx) {
    const p = planUpdate(args, ctx)
    if (p.error) return p.error
    const { d, rows, L } = p
    const clean = Object.fromEntries(Object.entries(args).filter(([k]) => k !== 'debt'))
    return ok(
      makeProposal({
        tool: 'update_debt',
        args: { debt: refOf(d.id), ...clean },
        risk: 'approve',
        summary: `Pending approval: change ${debtTitle(d)}.`,
        preview: { domain: 'debts', tone: 'change', title: `${L.changeDebt}: ${debtTitle(d)}`, rows },
      }),
    )
  },
  apply(proposal, ctx) {
    const p = planUpdate(proposal.args, ctx)
    if (p.error) return { ok: false, error: reason(p.error) }
    const { d, patch } = p
    const before = fin().debts
    fin().updateDebt(d.id, patch)
    const after = fin().debts
    const keys = changedKeys(before, after)
    return {
      ok: true,
      message: debtTitle(d),
      undo: () => useFinanceStore.setState((st) => ({ debts: revertRows(st.debts, before, after, keys, true) })),
    }
  },
}

const clear_debt: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = debtLabels(ctx.locale)
    const found = findDebt(s, args.debt)
    if (found.error) return found.error
    const d = found.debt
    if (d.debtType === 'credit_card') return fail('A credit card revolves and cannot be cleared.', 'Record payments, or delete the card instead.')
    if (!isOpen(d)) return fail('That debt is already cleared.')
    const left = remainingOf(s, d)
    return ok(
      makeProposal({
        tool: 'clear_debt',
        args: { debt: refOf(d.id) },
        risk: 'approve',
        summary: `Pending approval: mark ${debtTitle(d)} as cleared.`,
        preview: {
          domain: 'debts',
          tone: 'change',
          title: `${L.clearDebt}: ${debtTitle(d)}`,
          rows: [{ label: L.remaining, value: fmtDebt(left, d) }],
          ...(left > 1e-6 ? { effect: L.clearEffect(fmtDebt(left, d)) } : {}),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = clear_debt.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const s = fin()
    const found = findDebt(s, again.proposal.args.debt)
    if (found.error) return { ok: false, error: 'That debt no longer exists.' }
    const d = found.debt
    const savedSchedules = s.recurringDebtPayments.filter((r) => r.debtId === d.id)
    for (const r of savedSchedules) if (r.isActive) s.updateRecurringDebtPayment(r.id, { isActive: false })
    s.clearDebt(d.id)
    return {
      ok: true,
      message: debtTitle(d),
      undo: () =>
        useFinanceStore.setState((st) => ({
          debts: putBack(st.debts, [d], true),
          recurringDebtPayments: putBack(st.recurringDebtPayments, savedSchedules),
        })),
    }
  },
}

function planDelete(args: Record<string, unknown>) {
  const s = fin()
  const found = findDebt(s, args.debt)
  if (found.error) return { error: found.error }
  const d = found.debt
  const payments = s.debtPayments.filter((p) => p.debtId === d.id).length
  const schedules = s.recurringDebtPayments.filter((r) => r.debtId === d.id).length
  const expenses = s.expenses.filter((e) => e.linkedDebtId === d.id).length
  const plans = d.debtType === 'credit_card' ? s.debts.filter((x) => x.linkedCreditCardDebtId === d.id).length : 0
  const goals = s.goals.filter((g) => g.linkedDebtIds.includes(d.id) && g.category === 'debt_freedom' && g.status !== 'achieved' && g.linkedDebtIds.length === 1)
  return { s, d, payments, schedules, expenses, plans, goals }
}

const delete_debt: WriteImpl = {
  propose(args, ctx) {
    const p = planDelete(args)
    if (p.error) return p.error
    const L = debtLabels(ctx.locale)
    const { s, d, payments, schedules, expenses, plans, goals } = p
    return ok(
      makeProposal({
        tool: 'delete_debt',
        args: { debt: refOf(d.id) },
        risk: 'strong',
        summary: `Pending approval: delete ${debtTitle(d)} with ${payments} payment records.`,
        preview: {
          domain: 'debts',
          tone: 'danger',
          title: `${L.deleteDebt}: ${debtTitle(d)}`,
          rows: [
            { label: L.kind, value: L.kinds[kindOf(d)] },
            { label: L.remaining, value: fmtDebt(remainingOf(s, d), d) },
          ],
          effect: [L.deleteEffect(payments, schedules, expenses, plans), goals.length > 0 ? L.goalRemoved(goals.map((g) => g.name).join(', ')) : ''].filter(Boolean).join(' '),
        },
      }),
    )
  },
  apply(proposal) {
    const p = planDelete(proposal.args)
    if (p.error) return { ok: false, error: 'That debt no longer exists.' }
    const { debts, debtPayments, recurringDebtPayments, goals } = p.s
    fin().deleteDebt(p.d.id)
    const goalsAfter = fin().goals
    const goalKeys = changedKeys(goals, goalsAfter)
    const goalGone = new Set(goals.filter((g) => !goalsAfter.some((x) => x.id === g.id)).map((g) => g.id))
    return {
      ok: true,
      message: debtTitle(p.d),
      undo: () =>
        useFinanceStore.setState((st) => ({
          debts: restoreRows(st.debts, debts, new Set([p.d.id])),
          debtPayments: restoreRows(st.debtPayments, debtPayments, new Set(debtPayments.filter((x) => x.debtId === p.d.id).map((x) => x.id))),
          recurringDebtPayments: restoreRows(st.recurringDebtPayments, recurringDebtPayments, new Set(recurringDebtPayments.filter((r) => r.debtId === p.d.id).map((r) => r.id))),
          goals: revertRows(restoreRows(st.goals, goals, goalGone), goals, goalsAfter, goalKeys, true),
        })),
    }
  },
}

function planDeletePayment(args: Record<string, unknown>) {
  const s = fin()
  const hit = resolveRef(s.debtPayments, args.payment)
  if (hit.kind === 'none') return { error: fail('No payment has that ref.', 'Find it with get_debt first.') }
  if (hit.kind === 'many') return { error: fail('That ref matches several payments.', 'Use a longer ref from get_debt.') }
  const payment = hit.item
  const debt = s.debts.find((d) => d.id === payment.debtId)
  if (!debt) return { error: fail('That payment belongs to a debt that no longer exists.') }
  return { payment, debt }
}

const delete_debt_payment: WriteImpl = {
  propose(args, ctx) {
    const p = planDeletePayment(args)
    if (p.error) return p.error
    const L = debtLabels(ctx.locale)
    const { payment, debt } = p
    const cur = payment.originalAmount !== undefined ? (payment.paymentCurrency ?? curOf(debt)) : curOf(debt)
    const shown = cur === 'XAU' ? `${round2(payment.originalAmount ?? payment.amountPaid)} g` : money(round2(payment.originalAmount ?? payment.amountPaid), cur)
    return ok(
      makeProposal({
        tool: 'delete_debt_payment',
        args: { payment: refOf(payment.id) },
        risk: 'strong',
        summary: `Pending approval: delete the ${shown} payment on ${debtTitle(debt)}.`,
        preview: {
          domain: 'debts',
          tone: 'danger',
          title: `${L.deletePayment}: ${debtTitle(debt)}`,
          rows: [
            { label: L.amount, value: shown },
            { label: L.date, value: payment.date.slice(0, 10) },
          ],
          effect: [debt.status === 'cleared' ? L.reopens : '', payment.fundedFromSavings ? '' : L.paymentExpenseStays].filter(Boolean).join(' ') || undefined,
        },
      }),
    )
  },
  apply(proposal) {
    const p = planDeletePayment(proposal.args)
    if (p.error) return { ok: false, error: 'That payment no longer exists.' }
    const { debts, debtPayments, goals } = fin()
    fin().deleteDebtPayment(p.payment.id)
    const { debts: debtsAfter, goals: goalsAfter } = fin()
    return {
      ok: true,
      message: debtTitle(p.debt),
      undo: () =>
        useFinanceStore.setState((st) => ({
          debtPayments: restoreRows(st.debtPayments, debtPayments, new Set([p.payment.id])),
          debts: revertRows(st.debts, debts, debtsAfter, changedKeys(debts, debtsAfter), true),
          goals: revertRows(st.goals, goals, goalsAfter, changedKeys(goals, goalsAfter), true),
        })),
    }
  },
}

export const debtsTools = defineTools(debtsSpecs, {
  list_debts,
  get_debt,
  add_debt,
  add_installment_plan,
  add_credit_card,
  record_debt_payment,
  update_debt,
  clear_debt,
  delete_debt,
  delete_debt_payment,
})
