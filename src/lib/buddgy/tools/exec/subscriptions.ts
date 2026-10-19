import { addDays, format } from 'date-fns'
import { defineTools } from '@/lib/buddgy/tools/define'
import { methodField, resolveMethod } from '@/lib/buddgy/tools/exec/paymentMethodKit'
import { done, type Plan, reason } from '@/lib/buddgy/tools/exec/planKit'
import { putBack, restoreRows } from '@/lib/buddgy/tools/exec/restoreKit'
import { subLabels } from '@/lib/buddgy/tools/exec/subscriptionsCopy'
import { refOf, resolveByRefOrName } from '@/lib/buddgy/tools/refs'
import { subscriptionsSpecs } from '@/lib/buddgy/tools/specs/subscriptions'
import { fin } from '@/lib/buddgy/tools/stores'
import type { ReadImpl, ToolContext, WriteImpl } from '@/lib/buddgy/tools/types'
import { fail, makeProposal, money, num, ok, parseIsoDate, text } from '@/lib/buddgy/tools/writeKit'
import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import { plansForRegion, SUBSCRIPTION_CATALOG } from '@/lib/constants/subscriptionCatalog'
import type { Currency, FinanceStore, Subscription, SubscriptionBillingCycle, SubscriptionTracking } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { catalogRegionOf } from '@/lib/subscriptions/catalogDisplay'
import { cancelHint } from '@/lib/subscriptions/cancelHints'
import {
  committedImpact,
  draftToSubscription,
  type SubscriptionDraft,
  type SubscriptionPayload,
} from '@/lib/subscriptions/subscriptionDraft'
import {
  chargeAmount,
  cycleState,
  heroNumbers,
  isCharging,
  lifecycle,
  markPaidTarget,
  type Lifecycle,
} from '@/lib/subscriptions/subscriptionForecast'
import { priceChange } from '@/lib/subscriptions/subscriptionPricing'
import { subscriptionToMonthlyPlannerAmount } from '@/lib/subscriptions/subscriptionRecurring'
import { convertCurrency, tryConvertCurrency } from '@/lib/utils/currency'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { localTodayISO } from '@/lib/utils/localDate'

const LIST_CAP = 15
const CYCLES: SubscriptionBillingCycle[] = ['monthly', 'quarterly', 'semiannual', 'yearly', 'weekly']
const TRACKINGS: SubscriptionTracking[] = ['sms', 'ask', 'log']

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const shownName = (s: Subscription) => (s.planName ? `${s.name} ${s.planName}` : s.name)
const choiceOf = (s: Subscription) => ({ id: refOf(s.id), label: shownName(s) })

function findSub(
  s: FinanceStore,
  input: unknown,
  ctx: ToolContext,
  accept: (life: Lifecycle) => boolean,
  refusal: string,
): Plan<{ sub: Subscription; life: Lifecycle }> {
  const hit = resolveByRefOrName(s.subscriptions, input, (x) => x.name)
  if (hit.kind !== 'one') {
    const shown = hit.kind === 'many' ? hit.items : s.subscriptions.filter((x) => lifecycle(x, ctx.now) !== 'ended')
    return {
      error: fail(
        hit.kind === 'many' ? 'Several subscriptions match that name.' : 'No subscription matches that.',
        'Ask which one, or find it with list_subscriptions.',
        shown.slice(0, LIST_CAP).map(choiceOf),
      ),
    }
  }
  const life = lifecycle(hit.item, ctx.now)
  if (!accept(life)) return { error: fail(refusal) }
  return { sub: hit.item, life }
}

function parseCurrency(s: FinanceStore, input: unknown): Plan<{ currency: Currency }> {
  const base = s.settings.baseCurrency
  const wanted = text(input, 8)?.toUpperCase()
  if (!wanted) return { currency: base }
  if (clampFiatToAllowed(s.settings, wanted as Currency) !== wanted) {
    return { error: fail(`${wanted} is not an enabled currency.`, 'Ask which currency, or use the base currency.') }
  }
  if (tryConvertCurrency(1, wanted, base, s.exchangeRates) === null) {
    return { error: fail(`No exchange rate from ${wanted} to ${base}.`, 'Ask for the price in the base currency.') }
  }
  return { currency: wanted as Currency }
}

function parseCategory(input: unknown): Plan<{ category: string }> {
  const wanted = text(input, 40)?.toLowerCase()
  const hit = EXPENSE_ENTRY_CATEGORIES.find((c) => c.toLowerCase() === wanted)
  return hit ? { category: hit as string } : { error: fail('Unknown category.', `Use one of: ${EXPENSE_ENTRY_CATEGORIES.join(', ')}.`) }
}

const parseCycle = (input: unknown): Plan<{ cycle: SubscriptionBillingCycle }> =>
  CYCLES.includes(input as SubscriptionBillingCycle)
    ? { cycle: input as SubscriptionBillingCycle }
    : { error: fail(`Billing cycle must be one of: ${CYCLES.join(', ')}.`) }

const parseTracking = (input: unknown): Plan<{ tracking: SubscriptionTracking }> =>
  TRACKINGS.includes(input as SubscriptionTracking)
    ? { tracking: input as SubscriptionTracking }
    : { error: fail('Tracking must be sms, ask or log.') }

const draftOf = (sub: Subscription): SubscriptionDraft => ({
  name: sub.name,
  brandKey: sub.brandKey,
  planId: sub.planId,
  planName: sub.planName,
  planRegion: sub.catalogRegion,
  amount: sub.amount,
  currency: sub.currency,
  cycle: sub.billingCycle,
  firstCharge: sub.status === 'trial' && sub.trialEnd ? sub.trialEnd.slice(0, 10) : sub.startDate.slice(0, 10),
  paymentMethodId: sub.paymentMethodId,
  tracking: sub.tracking ?? 'sms',
  reminder: sub.reminder ?? true,
  trial: sub.status === 'trial',
  sharedWith: sub.sharedWith ?? [],
  myShare: sub.myShare ?? null,
  category: sub.expenseCategory,
  notes: sub.notes ?? '',
})

const rowSnapshot = (id: string) => {
  const s = fin()
  const sub = s.subscriptions.find((x) => x.id === id)
  const re = sub?.linkedRecurringExpenseId ? s.recurringExpenses.find((r) => r.id === sub.linkedRecurringExpenseId) : undefined
  return () =>
    useFinanceStore.setState((st) => ({
      subscriptions: sub ? putBack(st.subscriptions, [sub], true) : st.subscriptions,
      recurringExpenses: re ? putBack(st.recurringExpenses, [re], true) : st.recurringExpenses,
    }))
}

const list_subscriptions: ReadImpl = (args, ctx) => {
  const s = fin()
  const base = s.settings.baseCurrency
  const wanted = typeof args.status === 'string' ? args.status : 'default'
  const pool = s.subscriptions
    .map((sub) => ({ sub, life: lifecycle(sub, ctx.now) }))
    .filter(({ life }) => (wanted === 'default' ? life !== 'ended' : wanted === 'all' || wanted === life))
  const rows = pool
    .map(({ sub, life }) => {
      const charging = isCharging(sub, ctx.now)
      const cycle = charging ? cycleState(sub, s.expenses, ctx.now) : null
      return { sub, life, charging, cycle }
    })
    .sort((a, b) => (a.cycle && b.cycle ? a.cycle.due.getTime() - b.cycle.due.getTime() : a.cycle ? -1 : b.cycle ? 1 : 0))
  const hero = heroNumbers(s.subscriptions, s.expenses, ctx.now, base, s.exchangeRates)
  return {
    currency: base,
    monthly: Math.round(hero.monthlyEquivalent),
    yearly: Math.round(hero.perYear),
    due30: Math.round(hero.due30),
    count: rows.length,
    rows: rows.slice(0, LIST_CAP).map(({ sub, life, charging, cycle }) => ({
      ref: refOf(sub.id),
      name: sub.name,
      ...(sub.planName ? { plan: sub.planName } : {}),
      price: chargeAmount(sub),
      cur: sub.currency,
      cycle: sub.billingCycle,
      status: life,
      ...(cycle ? { next: iso(cycle.due), ...(cycle.kind === 'upcoming' ? {} : { state: cycle.kind }) } : {}),
      ...(charging ? { monthly: Math.round(convertCurrency(subscriptionToMonthlyPlannerAmount(chargeAmount(sub), sub.billingCycle), sub.currency, base, s.exchangeRates)) } : {}),
      ...(life === 'trial' && sub.trialEnd ? { trialEnds: sub.trialEnd.slice(0, 10) } : {}),
      ...(life === 'cancelled' && sub.endsOn ? { endsOn: sub.endsOn.slice(0, 10) } : {}),
      ...(sub.myShare != null ? { share: sub.myShare } : {}),
    })),
    ...(rows.length > LIST_CAP ? { more: rows.length - LIST_CAP } : {}),
  }
}

interface AddArgs {
  name: string
  amount: number
  currency: Currency
  cycle: SubscriptionBillingCycle
  firstCharge: string
  trial: boolean
  plan?: string
  category: string
  method?: string
  tracking: SubscriptionTracking
  notes?: string
}

function planAdd(args: Record<string, unknown>, ctx: ToolContext) {
  const s = fin()
  const name = text(args.name, 60)
  if (!name) return { error: fail('A subscription needs a name.') }
  const amount = num(args.amount)
  if (amount === undefined || amount <= 0) return { error: fail('The price must be above zero.') }
  const cycle = parseCycle(args.cycle)
  if (cycle.error) return cycle
  const cur = parseCurrency(s, args.currency)
  if (cur.error) return cur
  const trial = args.trial === true
  const today = localTodayISO(ctx.now)
  if (trial && args.firstCharge === undefined) return { error: fail('Ask when the free trial ends.', 'firstCharge is the trial end date.') }
  const firstCharge = args.firstCharge === undefined ? today : parseIsoDate(args.firstCharge)
  if (!firstCharge) return { error: fail('The first charge must be a real date like 2026-10-19.') }
  if (trial && firstCharge < today) return { error: fail('The trial end date has already passed.') }

  const brand = SUBSCRIPTION_CATALOG.find((b) => b.name.toLowerCase() === name.toLowerCase())
  const region = catalogRegionOf(s.profile)
  const planName = text(args.plan, 60)
  const catalogPlan = brand && planName ? plansForRegion(brand, region).find((p) => p.name.toLowerCase() === planName.toLowerCase()) : undefined
  let category = brand?.defaultCategory ?? 'Enjoyment'
  if (args.category !== undefined) {
    const c = parseCategory(args.category)
    if (c.error) return c
    category = c.category
  }
  const method = resolveMethod(s, args.method)
  if (method.error) return { error: method.error }
  let tracking: SubscriptionTracking = 'sms'
  if (args.tracking !== undefined) {
    const t = parseTracking(args.tracking)
    if (t.error) return t
    tracking = t.tracking
  }
  const notes = text(args.notes, 300)

  const draft: SubscriptionDraft = {
    name,
    brandKey: brand?.key ?? null,
    planId: catalogPlan?.id ?? null,
    planName: catalogPlan?.name ?? planName ?? null,
    planRegion: catalogPlan ? region : null,
    amount,
    currency: cur.currency,
    cycle: cycle.cycle,
    firstCharge,
    paymentMethodId: method.id || null,
    tracking,
    reminder: true,
    trial,
    sharedWith: [],
    myShare: null,
    category,
    notes: notes ?? '',
  }
  const clean: AddArgs = {
    name,
    amount,
    currency: cur.currency,
    cycle: cycle.cycle,
    firstCharge,
    trial,
    category,
    tracking,
    ...(planName ? { plan: planName } : {}),
    ...(method.id ? { method: refOf(method.id) } : {}),
    ...(notes ? { notes } : {}),
  }
  const duplicate = s.subscriptions.some((x) => x.name.toLowerCase() === name.toLowerCase() && lifecycle(x, ctx.now) !== 'ended')
  return done({ s, draft, clean, today, duplicate, methodId: method.id })
}

const add_subscription: WriteImpl = {
  propose(args, ctx) {
    const p = planAdd(args, ctx)
    if (p.error) return p.error
    const L = subLabels(ctx.locale)
    const { s, draft, clean, duplicate, methodId } = p
    const base = s.settings.baseCurrency
    const impact = committedImpact(draft, s.subscriptions, null, base, s.exchangeRates)
    const methodName = s.paymentMethods.find((m) => m.id === methodId)?.name
    const effect = [
      draft.trial ? L.trialEffect : L.impact(money(Math.round(impact.monthly), base), money(Math.round(impact.after), base)),
      duplicate ? L.duplicate : '',
    ]
      .filter(Boolean)
      .join(' ')
    return ok(
      makeProposal({
        tool: 'add_subscription',
        args: clean as unknown as Record<string, unknown>,
        risk: 'approve',
        summary: `Pending approval: add ${draft.name} ${money(draft.amount, draft.currency)} ${draft.cycle}.`,
        preview: {
          domain: 'subscriptions',
          tone: 'add',
          title: L.addSub,
          rows: [
            { label: L.name, value: draft.name },
            ...(draft.planName ? [{ label: L.plan, value: draft.planName }] : []),
            { label: L.amount, value: `${money(draft.amount, draft.currency)} · ${L.cycles[draft.cycle]}` },
            { label: draft.trial ? L.trialEnds : L.firstCharge, value: draft.firstCharge },
            { label: L.category, value: draft.category },
            ...(methodName ? [{ label: L.method, value: methodName }] : []),
            { label: L.tracking, value: L.trackings[draft.tracking] },
          ],
          fields: [
            { key: 'name', label: L.name, kind: 'text', value: draft.name },
            { key: 'amount', label: L.amount, kind: 'amount', value: String(draft.amount), currency: draft.currency },
            {
              key: 'cycle',
              label: L.cycle,
              kind: 'select',
              value: draft.cycle,
              options: CYCLES.map((c) => ({ value: c, label: L.cycles[c] })),
            },
            { key: 'firstCharge', label: draft.trial ? L.trialEnds : L.firstCharge, kind: 'date', value: draft.firstCharge },
            methodField(s, methodId, L.method),
          ],
          effect,
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = planAdd(proposal.args, ctx)
    if (again.error) return { ok: false, error: reason(again.error) }
    const id = fin().addSubscription(draftToSubscription(again.draft, null, again.today))
    return { ok: true, message: shownName(again.draft as unknown as Subscription), undo: () => fin().deleteSubscription(id) }
  },
}

const SHOWN_KEYS = ['name', 'amount', 'currency', 'billingCycle', 'billingDay', 'expenseCategory', 'paymentMethodId', 'tracking', 'notes'] as const

const same = (a: unknown, b: unknown): boolean => {
  const norm = (v: unknown) => (v == null || (Array.isArray(v) && v.length === 0) ? null : JSON.stringify(v))
  return norm(a) === norm(b)
}

function planUpdate(args: Record<string, unknown>, ctx: ToolContext) {
  const s = fin()
  const L = subLabels(ctx.locale)
  const found = findSub(s, args.sub, ctx, (l) => l === 'active' || l === 'trial' || l === 'paused', 'That subscription has ended. Re-subscribe it first.')
  if (found.error) return found
  const { sub } = found
  const draft = draftOf(sub)

  if (args.name !== undefined) {
    const name = text(args.name, 60)
    if (!name) return { error: fail('The name cannot be empty.') }
    draft.name = name
  }
  if (args.currency !== undefined) {
    const cur = parseCurrency(s, args.currency)
    if (cur.error) return cur
    if (cur.currency !== sub.currency && args.amount === undefined) return { error: fail('Send the price in the new currency too.') }
    draft.currency = cur.currency
  }
  if (args.amount !== undefined) {
    const amount = num(args.amount)
    if (amount === undefined || amount <= 0) return { error: fail('The price must be above zero.') }
    if (sub.myShare != null && amount < sub.myShare) return { error: fail('The price cannot be below the user share on a shared plan.') }
    draft.amount = amount
  }
  if (args.cycle !== undefined) {
    const cycle = parseCycle(args.cycle)
    if (cycle.error) return cycle
    draft.cycle = cycle.cycle
  }
  if (args.category !== undefined) {
    const c = parseCategory(args.category)
    if (c.error) return c
    draft.category = c.category
  }
  if (args.method !== undefined) {
    const m = resolveMethod(s, args.method)
    if (m.error) return { error: m.error }
    draft.paymentMethodId = m.id || null
  }
  if (args.tracking !== undefined) {
    const t = parseTracking(args.tracking)
    if (t.error) return t
    draft.tracking = t.tracking
  }
  if (args.notes !== undefined) draft.notes = typeof args.notes === 'string' ? args.notes.trim().slice(0, 300) : draft.notes
  const billingDay = args.billingDay === undefined ? undefined : num(args.billingDay)
  if (args.billingDay !== undefined && (billingDay === undefined || !Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31)) {
    return { error: fail('The billing day must be a whole number from 1 to 31.') }
  }

  const full: SubscriptionPayload = { ...draftToSubscription(draft, sub, localTodayISO(ctx.now)), ...(billingDay !== undefined ? { billingDay } : {}) }
  const patch: Partial<Subscription> = {}
  for (const key of Object.keys(full) as (keyof SubscriptionPayload)[]) {
    if (key === 'nextBillingDate') continue
    if (!same(full[key], sub[key])) (patch as Record<string, unknown>)[key] = full[key]
  }
  const changed = SHOWN_KEYS.filter((k) => k in patch)
  if (changed.length === 0) return { error: fail('Nothing would change.') }

  const methodName = (id: string | null) => s.paymentMethods.find((m) => m.id === id)?.name ?? '—'
  const rows = changed.map((key) => {
    const fmt = (src: Subscription | Partial<Subscription>) => {
      switch (key) {
        case 'amount':
          return money((src.amount ?? sub.amount), (src.currency ?? sub.currency))
        case 'currency':
          return String(src.currency ?? sub.currency)
        case 'billingCycle':
          return L.cycles[(src.billingCycle ?? sub.billingCycle) as SubscriptionBillingCycle]
        case 'paymentMethodId':
          return methodName(src.paymentMethodId === undefined ? sub.paymentMethodId : src.paymentMethodId)
        case 'tracking':
          return L.trackings[(src.tracking ?? sub.tracking ?? 'sms') as SubscriptionTracking]
        default:
          return String(src[key] ?? '—')
      }
    }
    const labelOf: Record<(typeof SHOWN_KEYS)[number], string> = {
      name: L.name, amount: L.amount, currency: L.amount, billingCycle: L.cycle, billingDay: L.billingDay,
      expenseCategory: L.category, paymentMethodId: L.method, tracking: L.tracking, notes: L.notes,
    }
    return { label: labelOf[key], before: fmt(sub), value: fmt({ ...sub, ...patch }) }
  })
  const seen = new Set<string>()
  const uniqueRows = rows.filter((r) => (seen.has(r.label) ? false : (seen.add(r.label), true)))
  return done({ s, sub, patch, rows: uniqueRows, L })
}

const update_subscription: WriteImpl = {
  propose(args, ctx) {
    const p = planUpdate(args, ctx)
    if (p.error) return p.error
    const { sub, rows, L } = p
    const clean = Object.fromEntries(Object.entries(args).filter(([k]) => k !== 'sub'))
    return ok(
      makeProposal({
        tool: 'update_subscription',
        args: { sub: refOf(sub.id), ...clean },
        risk: 'approve',
        summary: `Pending approval: change ${sub.name}.`,
        preview: { domain: 'subscriptions', tone: 'change', title: `${L.changeSub}: ${sub.name}`, rows },
      }),
    )
  },
  apply(proposal, ctx) {
    const p = planUpdate(proposal.args, ctx)
    if (p.error) return { ok: false, error: reason(p.error) }
    const restore = rowSnapshot(p.sub.id)
    fin().updateSubscription(p.sub.id, p.patch)
    return { ok: true, message: p.sub.name, undo: restore }
  },
}

const lifecycleTool = (opts: {
  tool: string
  accept: (l: Lifecycle) => boolean
  refusal: string
  title: (L: ReturnType<typeof subLabels>, l: Lifecycle) => string
  effect: (L: ReturnType<typeof subLabels>, l: Lifecycle) => string
  run: (id: string, l: Lifecycle) => void
}): WriteImpl => {
  const impl: WriteImpl = {
    propose(args, ctx) {
      const s = fin()
      const L = subLabels(ctx.locale)
      const found = findSub(s, args.sub, ctx, opts.accept, opts.refusal)
      if (found.error) return found.error
      const { sub, life } = found
      return ok(
        makeProposal({
          tool: opts.tool,
          args: { sub: refOf(sub.id) },
          risk: 'approve',
          summary: `Pending approval: ${opts.title(L, life).toLowerCase()} ${sub.name}.`,
          preview: {
            domain: 'subscriptions',
            tone: 'change',
            title: `${opts.title(L, life)}: ${sub.name}`,
            rows: [
              { label: L.amount, value: `${money(chargeAmount(sub), sub.currency)} · ${L.cycles[sub.billingCycle]}` },
              { label: L.status, value: L.statuses[life], before: undefined },
            ],
            effect: opts.effect(L, life),
          },
        }),
      )
    },
    apply(proposal, ctx) {
      const again = impl.propose(proposal.args, ctx)
      if (!again.ok) return { ok: false, error: again.error }
      const s = fin()
      const found = findSub(s, again.proposal.args.sub, ctx, opts.accept, opts.refusal)
      if (found.error) return { ok: false, error: 'That subscription no longer exists.' }
      const restore = rowSnapshot(found.sub.id)
      opts.run(found.sub.id, found.life)
      return { ok: true, message: found.sub.name, undo: restore }
    },
  }
  return impl
}

const pause_subscription = lifecycleTool({
  tool: 'pause_subscription',
  accept: (l) => l === 'active' || l === 'trial',
  refusal: 'Only an active subscription or trial can be paused.',
  title: (L) => L.pauseSub,
  effect: (L) => L.pauseEffect,
  run: (id) => fin().pauseSubscription(id),
})

const resume_subscription = lifecycleTool({
  tool: 'resume_subscription',
  accept: (l) => l === 'paused' || l === 'cancelled' || l === 'ended',
  refusal: 'That subscription is already active.',
  title: (L, l) => (l === 'paused' ? L.resumeSub : L.resubscribeSub),
  effect: (L, l) => (l === 'paused' ? L.resumeEffect : L.resubscribeEffect),
  run: (id, l) => (l === 'paused' ? fin().resumeSubscription(id) : fin().reactivateSubscription(id)),
})

function planCancel(args: Record<string, unknown>, ctx: ToolContext) {
  const s = fin()
  const found = findSub(s, args.sub, ctx, (l) => l === 'active' || l === 'trial' || l === 'paused', 'That subscription is already cancelled.')
  if (found.error) return found
  const { sub } = found
  let endsOn: string
  if (args.endsOn === undefined) {
    const c = cycleState(sub, s.expenses, ctx.now)
    endsOn = c.kind === 'upcoming' ? iso(addDays(c.due, -1)) : localTodayISO(ctx.now)
  } else {
    const d = parseIsoDate(args.endsOn)
    if (!d) return { error: fail('The end date must be a real date like 2026-10-19.') }
    endsOn = d
  }
  return done({ s, sub, endsOn })
}

const cancel_subscription: WriteImpl = {
  propose(args, ctx) {
    const p = planCancel(args, ctx)
    if (p.error) return p.error
    const L = subLabels(ctx.locale)
    const { sub, endsOn } = p
    const hint = cancelHint(sub.brandKey)
    return ok(
      makeProposal({
        tool: 'cancel_subscription',
        args: { sub: refOf(sub.id), endsOn },
        risk: 'approve',
        summary: `Pending approval: cancel ${sub.name}, access until ${endsOn}. The user must still cancel with the service.`,
        preview: {
          domain: 'subscriptions',
          tone: 'danger',
          title: `${L.cancelSub}: ${sub.name}`,
          rows: [
            { label: L.endsOn, value: endsOn },
            ...(hint ? [{ label: L.howTo, value: hint.text }] : []),
          ],
          fields: [{ key: 'endsOn', label: L.endsOn, kind: 'date', value: endsOn }],
          effect: L.cancelEffect(sub.name),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const p = planCancel(proposal.args, ctx)
    if (p.error) return { ok: false, error: reason(p.error) }
    const restore = rowSnapshot(p.sub.id)
    fin().cancelSubscription(p.sub.id, p.endsOn)
    return { ok: true, message: p.sub.name, undo: restore }
  },
}

function planMarkPaid(args: Record<string, unknown>, ctx: ToolContext) {
  const s = fin()
  const found = findSub(s, args.sub, ctx, (l) => l === 'active', 'Only an active subscription can be marked paid.')
  if (found.error) return found
  const { sub } = found
  const target = markPaidTarget(sub, s.expenses, ctx.now)
  if (!target) {
    return { error: fail('Nothing to mark paid: this cycle is already recorded, or the next charge is more than 7 days away.') }
  }
  const methodId = sub.paymentMethodId || s.paymentMethods.find((m) => m.isDefault)?.id || s.paymentMethods[0]?.id || ''
  return done({ s, sub, date: iso(target), methodId })
}

const mark_subscription_paid: WriteImpl = {
  propose(args, ctx) {
    const p = planMarkPaid(args, ctx)
    if (p.error) return p.error
    const L = subLabels(ctx.locale)
    const { s, sub, date, methodId } = p
    const methodName = s.paymentMethods.find((m) => m.id === methodId)?.name
    const amount = chargeAmount(sub)
    return ok(
      makeProposal({
        tool: 'mark_subscription_paid',
        args: { sub: refOf(sub.id), date },
        risk: 'approve',
        summary: `Pending approval: record ${shownName(sub)} ${money(amount, sub.currency)} on ${date}.`,
        preview: {
          domain: 'subscriptions',
          tone: 'add',
          title: `${L.markPaid}: ${sub.name}`,
          rows: [
            { label: L.amount, value: money(amount, sub.currency) },
            { label: L.nextCharge, value: date },
            ...(methodName ? [{ label: L.method, value: methodName }] : []),
          ],
          effect: L.markPaidEffect,
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const p = planMarkPaid(proposal.args, ctx)
    if (p.error) return { ok: false, error: reason(p.error) }
    if (p.date !== proposal.args.date) return { ok: false, error: 'The charge date changed since this was proposed. Ask again.' }
    const before = new Set(p.s.expenses.map((e) => e.id))
    p.s.markSubscriptionPaid(p.sub.id, { date: p.date })
    const created = fin().expenses.find((e) => !before.has(e.id))
    return {
      ok: true,
      message: `${shownName(p.sub)} · ${money(chargeAmount(p.sub), p.sub.currency)}`,
      undo: created ? () => fin().deleteExpense(created.id) : undefined,
    }
  },
}

function planAdopt(args: Record<string, unknown>, ctx: ToolContext) {
  const s = fin()
  const found = findSub(s, args.sub, ctx, (l) => l === 'active', 'Only an active subscription can adopt a new price.')
  if (found.error) return found
  const change = priceChange(found.sub, s.expenses)
  if (!change) {
    return { error: fail('No price change was detected from the latest charge.', 'To set a price the user states, use update_subscription.') }
  }
  return done({ sub: found.sub, change })
}

const adopt_subscription_price: WriteImpl = {
  propose(args, ctx) {
    const p = planAdopt(args, ctx)
    if (p.error) return p.error
    const L = subLabels(ctx.locale)
    const { sub, change } = p
    return ok(
      makeProposal({
        tool: 'adopt_subscription_price',
        args: { sub: refOf(sub.id), amount: change.to },
        risk: 'approve',
        summary: `Pending approval: change ${sub.name} price from ${money(change.from, sub.currency)} to ${money(change.to, sub.currency)}.`,
        preview: {
          domain: 'subscriptions',
          tone: 'change',
          title: `${L.adoptPrice}: ${sub.name}`,
          rows: [{ label: L.amount, before: money(change.from, sub.currency), value: money(change.to, sub.currency) }],
          effect: L.adoptEffect,
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const p = planAdopt(proposal.args, ctx)
    if (p.error) return { ok: false, error: reason(p.error) }
    if (p.change.to !== proposal.args.amount) return { ok: false, error: 'The latest charge changed since this was proposed. Ask again.' }
    const restore = rowSnapshot(p.sub.id)
    fin().adoptSubscriptionPrice(p.sub.id, p.change.to)
    return { ok: true, message: p.sub.name, undo: restore }
  },
}

function planDelete(args: Record<string, unknown>, ctx: ToolContext) {
  const s = fin()
  const found = findSub(s, args.sub, ctx, () => true, '')
  if (found.error) return found
  const charges = s.expenses.filter((e) => e.linkedSubscriptionId === found.sub.id).length
  return done({ sub: found.sub, charges })
}

const delete_subscription: WriteImpl = {
  propose(args, ctx) {
    const p = planDelete(args, ctx)
    if (p.error) return p.error
    const L = subLabels(ctx.locale)
    const { sub, charges } = p
    return ok(
      makeProposal({
        tool: 'delete_subscription',
        args: { sub: refOf(sub.id) },
        risk: 'strong',
        summary: `Pending approval: delete ${sub.name}.`,
        preview: {
          domain: 'subscriptions',
          tone: 'danger',
          title: `${L.deleteSub}: ${sub.name}`,
          rows: [
            { label: L.amount, value: `${money(chargeAmount(sub), sub.currency)} · ${L.cycles[sub.billingCycle]}` },
            { label: L.status, value: L.statuses[lifecycle(sub, ctx.now)] },
          ],
          effect: L.deleteEffect(charges),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const p = planDelete(proposal.args, ctx)
    if (p.error) return { ok: false, error: 'That subscription no longer exists.' }
    const { subscriptions, recurringExpenses } = fin()
    const linkedId = p.sub.linkedRecurringExpenseId
    fin().deleteSubscription(p.sub.id)
    return {
      ok: true,
      message: p.sub.name,
      undo: () =>
        useFinanceStore.setState((st) => ({
          subscriptions: restoreRows(st.subscriptions, subscriptions, new Set([p.sub.id])),
          recurringExpenses: restoreRows(st.recurringExpenses, recurringExpenses, new Set(linkedId ? [linkedId] : [])),
        })),
    }
  },
}

export const subscriptionsTools = defineTools(subscriptionsSpecs, {
  list_subscriptions,
  add_subscription,
  update_subscription,
  pause_subscription,
  resume_subscription,
  cancel_subscription,
  mark_subscription_paid,
  adopt_subscription_price,
  delete_subscription,
})
