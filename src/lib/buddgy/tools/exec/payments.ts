import { defineTools } from '@/lib/buddgy/tools/define'
import { paymentLabels } from '@/lib/buddgy/tools/exec/paymentsCopy'
import { refOf, resolveByRefOrName } from '@/lib/buddgy/tools/refs'
import { restoreRows, revertRows } from '@/lib/buddgy/tools/exec/restoreKit'
import { paymentsSpecs } from '@/lib/buddgy/tools/specs/payments'
import { fin } from '@/lib/buddgy/tools/stores'
import type { ReadImpl, WriteImpl } from '@/lib/buddgy/tools/types'
import { fail, makeProposal, ok, text } from '@/lib/buddgy/tools/writeKit'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import { allowsLast4, composePaymentMethodName, decomposePaymentMethodName, PAYMENT_TYPE_META, SETUP_TYPES } from '@/lib/payment/paymentMethodDefaults'
import { getOpenDefaultCandidate, isPaymentMethodReferenced } from '@/lib/accounts/removePaymentMethod'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, FinanceStore, PaymentMethod, PaymentMethodType } from '@/lib/store/types'

/** Closed accounts are gone as far as the assistant is concerned (their history stays in the ledger). */
export const liveMethods = (s: FinanceStore): PaymentMethod[] => s.paymentMethods.filter((m) => !m.closedAt)

const cascadeSlices = (s: FinanceStore) => ({
  paymentMethods: s.paymentMethods,
  expenses: s.expenses,
  debts: s.debts,
  subscriptions: s.subscriptions,
  incomeSources: s.incomeSources,
  incomeEvents: s.incomeEvents,
})

const HEX_RE = /^#[0-9a-f]{6}$/i
const LAST4_RE = /^\d{4}$/
const LIST_CAP = 15

/** Resolves a method by ref or exact name; omitted means the usual one. Never falls back when a named one is missing. */
export function resolvePaymentMethod(s: FinanceStore, input: unknown): { id: string } | { error: ReturnType<typeof fail> } {
  if (input === undefined || input === null || input === '') {
    const usual = liveMethods(s).find((m) => m.isDefault) ?? liveMethods(s)[0]
    return { id: usual?.id ?? '' }
  }
  const hit = resolveByRefOrName(liveMethods(s), input, (m) => m.name)
  if (hit.kind === 'one') return { id: hit.item.id }
  const choices = (hit.kind === 'many' ? hit.items : liveMethods(s)).map((m) => ({ id: refOf(m.id), label: m.name }))
  return {
    error: fail(
      hit.kind === 'many' ? 'Several payment methods match.' : 'No payment method matches.',
      'Ask which one, or omit it to use the usual one.',
      choices,
    ),
  }
}

function target(s: FinanceStore, ref: unknown): { method: PaymentMethod } | { error: ReturnType<typeof fail> } {
  const hit = resolveByRefOrName(liveMethods(s), ref, (m) => m.name)
  if (hit.kind === 'one') return { method: hit.item }
  const choices = (hit.kind === 'many' ? hit.items : liveMethods(s)).map((m) => ({ id: refOf(m.id), label: m.name }))
  return { error: fail(hit.kind === 'many' ? 'Several payment methods match.' : 'No payment method matches.', 'Ask which one.', choices) }
}

const nameTaken = (s: FinanceStore, name: string, exceptId?: string): boolean =>
  liveMethods(s).some((m) => m.id !== exceptId && m.name.trim().toLowerCase() === name.toLowerCase())

const list_payment_methods: ReadImpl = () => {
  const methods = liveMethods(fin())
  return {
    methods: methods.slice(0, LIST_CAP).map((m) => ({
      ref: refOf(m.id),
      name: m.name,
      type: m.type,
      cur: m.currency,
      ...(m.isDefault ? { default: true } : {}),
    })),
    ...(methods.length > LIST_CAP ? { more: methods.length - LIST_CAP } : {}),
  }
}

const add_payment_method: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = paymentLabels(ctx.locale)
    const provider = text(args.name, 40)
    if (!provider) return fail('A payment method needs a name.')
    const type = args.type as PaymentMethodType
    if (!SETUP_TYPES.includes(type)) return fail('Unknown type.', `Use one of: ${SETUP_TYPES.join(', ')}. Cash is built in.`)
    const currency = (text(args.currency, 8)?.toUpperCase() ?? s.settings.baseCurrency) as Currency
    if (!FIAT_CURRENCIES.includes(currency)) return fail(`${currency} is not a supported currency.`)
    const last4 = text(args.last4, 8)
    if (last4 !== undefined && !allowsLast4(type)) return fail(`A ${PAYMENT_TYPE_META[type].label.toLowerCase()} has no last 4 digits.`)
    if (last4 !== undefined && !LAST4_RE.test(last4)) return fail('Last 4 digits must be exactly 4 digits.')
    const color = text(args.color, 7)
    if (color !== undefined && !HEX_RE.test(color)) return fail('Color must look like #3B82F6.')
    const name = composePaymentMethodName(provider, { last4 })
    if (nameTaken(s, name)) return fail(L.exists, 'Use update_payment_method, or add a last4 to tell them apart.')

    const makeDefault = args.makeDefault === true
    const clean = { name: provider, type, currency, makeDefault, ...(last4 ? { last4 } : {}), ...(color ? { color } : {}) }
    return ok(
      makeProposal({
        tool: 'add_payment_method',
        args: clean,
        risk: 'approve',
        summary: `Pending approval: add payment method ${name}.`,
        preview: {
          domain: 'payments',
          tone: 'add',
          title: L.addMethod,
          rows: [
            { label: L.name, value: name },
            { label: L.type, value: L.types[type] },
            { label: L.currency, value: currency },
            ...(makeDefault ? [{ label: L.makeDefault, value: L.yes }] : []),
          ],
          fields: [
            { key: 'name', label: L.name, kind: 'text', value: provider },
            ...(allowsLast4(type) ? [{ key: 'last4', label: L.last4, kind: 'text' as const, value: last4 ?? '' }] : []),
          ],
          ...(type === 'credit_card' ? { effect: L.creditCardDebt } : {}),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = add_payment_method.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const a = again.proposal.args
    const before = fin()
    const previousDefault = before.paymentMethods.find((m) => m.isDefault)
    const debtIds = new Set(before.debts.map((d) => d.id))
    const type = a.type as PaymentMethodType
    const name = composePaymentMethodName(a.name as string, { last4: a.last4 as string | undefined })
    const id = before.addPaymentMethod({
      name,
      type,
      currency: a.currency as Currency,
      color: (a.color as string | undefined) ?? PAYMENT_TYPE_META[type].color,
      isDefault: a.makeDefault === true,
      ...(a.last4 ? { last4: a.last4 as string } : {}),
    })
    const createdDebt = fin().debts.find((d) => !debtIds.has(d.id))
    return {
      ok: true,
      message: name,
      undo: () => {
        const s = fin()
        s.deletePaymentMethod(id)
        if (createdDebt) fin().deleteDebt(createdDebt.id)
        if (a.makeDefault === true && previousDefault) fin().updatePaymentMethod(previousDefault.id, { isDefault: true })
      },
    }
  },
}

const update_payment_method: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = paymentLabels(ctx.locale)
    const hit = target(s, args.ref)
    if ('error' in hit) return hit.error
    const m = hit.method
    const rows: { label: string; value: string; before: string }[] = []

    const identityChange = args.name !== undefined || args.last4 !== undefined || args.color !== undefined
    if (m.type === 'cash' && identityChange) return fail(L.cashFixed)

    const dec = decomposePaymentMethodName(m.name, m.last4)
    const provider = args.name !== undefined ? text(args.name, 40) : dec.provider
    if (!provider) return fail('The name cannot be empty.')
    let last4 = m.last4
    if (args.last4 !== undefined) {
      const v = typeof args.last4 === 'string' ? args.last4.trim() : ''
      if (v !== '' && !allowsLast4(m.type)) return fail(`A ${PAYMENT_TYPE_META[m.type].label.toLowerCase()} has no last 4 digits.`)
      if (v !== '' && !LAST4_RE.test(v)) return fail('Last 4 digits must be exactly 4 digits.')
      last4 = v === '' ? undefined : v
    }
    if (args.name !== undefined || args.last4 !== undefined) {
      const name = composePaymentMethodName(provider, { last4, tag: last4 ? undefined : dec.tag })
      if (name !== m.name) {
        if (nameTaken(s, name, m.id)) return fail(L.exists)
        rows.push({ label: L.name, before: m.name, value: name })
      }
    }
    if (args.color !== undefined) {
      const color = text(args.color, 7)
      if (!color || !HEX_RE.test(color)) return fail('Color must look like #3B82F6.')
      if (color.toLowerCase() !== (m.color ?? '').toLowerCase()) {
        rows.push({ label: L.color, before: m.color ?? L.none, value: color })
      }
    }
    if (args.makeDefault !== undefined) {
      if (args.makeDefault !== true) return fail('A default cannot be switched off.', 'Make another payment method the default instead.')
      if (!m.isDefault) {
        rows.push({ label: L.makeDefault, before: L.none, value: L.yes })
      }
    }
    if (rows.length === 0) return fail('Nothing would change.')

    return ok(
      makeProposal({
        tool: 'update_payment_method',
        args: { ref: refOf(m.id), ...Object.fromEntries(Object.entries(args).filter(([k, v]) => k !== 'ref' && v !== undefined)) },
        risk: 'approve',
        summary: `Pending approval: change payment method ${m.name}.`,
        preview: { domain: 'payments', tone: 'change', title: `${L.changeMethod}: ${m.name}`, rows },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = update_payment_method.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const s = fin()
    const hit = target(s, again.proposal.args.ref)
    if ('error' in hit) return { ok: false, error: 'That payment method no longer exists.' }
    const m = hit.method
    const a = again.proposal.args
    const dec = decomposePaymentMethodName(m.name, m.last4)
    const patch: Partial<PaymentMethod> = {}
    if (a.name !== undefined || a.last4 !== undefined) {
      const provider = a.name !== undefined ? (text(a.name, 40) ?? dec.provider) : dec.provider
      const last4 = a.last4 === undefined ? m.last4 : text(a.last4, 8)
      patch.name = composePaymentMethodName(provider, { last4, tag: last4 ? undefined : dec.tag })
      patch.last4 = last4
    }
    if (a.color !== undefined) patch.color = a.color as string
    if (a.makeDefault === true) patch.isDefault = true
    const previousDefault = liveMethods(s).find((p) => p.isDefault && p.id !== m.id)
    const previous = { name: m.name, last4: m.last4, color: m.color, isDefault: m.isDefault }
    s.updatePaymentMethod(m.id, patch)
    return {
      ok: true,
      message: patch.name ?? m.name,
      undo: () => {
        fin().updatePaymentMethod(m.id, previous)
        if (patch.isDefault && previousDefault) fin().updatePaymentMethod(previousDefault.id, { isDefault: true })
      },
    }
  },
}

const delete_payment_method: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = paymentLabels(ctx.locale)
    const hit = target(s, args.ref)
    if ('error' in hit) return hit.error
    const m = hit.method
    if (m.type === 'cash') return fail(L.cashFixed)

    const effects: string[] = []
    if (isPaymentMethodReferenced(s, m.id)) effects.push(L.closedKeepsHistory)
    const heir = m.isDefault ? getOpenDefaultCandidate(s.paymentMethods, m.id) : undefined
    if (heir) effects.push(L.newDefault(heir.name))

    return ok(
      makeProposal({
        tool: 'delete_payment_method',
        args: { ref: refOf(m.id) },
        risk: 'strong',
        summary: `Pending approval: delete payment method ${m.name}.`,
        preview: {
          domain: 'payments',
          tone: 'danger',
          title: `${L.deleteMethod}: ${m.name}`,
          rows: [
            { label: L.type, value: L.types[m.type] },
            { label: L.currency, value: m.currency },
          ],
          ...(effects.length ? { effect: effects.join(' · ') } : {}),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = delete_payment_method.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const hit = target(fin(), again.proposal.args.ref)
    if ('error' in hit) return { ok: false, error: 'That payment method no longer exists.' }
    const id = hit.method.id
    const was = cascadeSlices(fin())
    fin().deletePaymentMethod(id)
    const now = cascadeSlices(fin())
    const keptDebtIds = new Set(now.debts.map((d) => d.id))
    const removedDebtIds = new Set(was.debts.filter((d) => !keptDebtIds.has(d.id)).map((d) => d.id))
    return {
      ok: true,
      message: hit.method.name,
      undo: () =>
        useFinanceStore.setState((st) => ({
          paymentMethods: revertRows(restoreRows(st.paymentMethods, was.paymentMethods, new Set([id])), was.paymentMethods, now.paymentMethods, ['isDefault', 'closedAt', 'parentId'], true),
          expenses: revertRows(st.expenses, was.expenses, now.expenses, ['paymentMethodId']),
          debts: revertRows(restoreRows(st.debts, was.debts, removedDebtIds), was.debts, now.debts, ['linkedPaymentMethodId']),
          subscriptions: revertRows(st.subscriptions, was.subscriptions, now.subscriptions, ['paymentMethodId']),
          incomeSources: revertRows(st.incomeSources, was.incomeSources, now.incomeSources, ['paymentMethodId']),
          incomeEvents: revertRows(st.incomeEvents, was.incomeEvents, now.incomeEvents, ['paymentMethodId']),
        })),
    }
  },
}

export const paymentsTools = defineTools(paymentsSpecs, { list_payment_methods, add_payment_method, update_payment_method, delete_payment_method })
