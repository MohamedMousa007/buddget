import { defineTools } from '@/lib/buddgy/tools/define'
import { incomeLabels } from '@/lib/buddgy/tools/exec/incomeCopy'
import { resolvePaymentMethod } from '@/lib/buddgy/tools/exec/payments'
import type { EditableField, PreviewRow, ProposeResult } from '@/lib/buddgy/tools/proposal'
import { restoreRows } from '@/lib/buddgy/tools/exec/restoreKit'
import { refOf, resolveByRefOrName } from '@/lib/buddgy/tools/refs'
import { incomeSpecs } from '@/lib/buddgy/tools/specs/income'
import { fin, ui } from '@/lib/buddgy/tools/stores'
import type { ReadImpl, ToolContext, WriteImpl } from '@/lib/buddgy/tools/types'
import { fail, makeProposal, money, num, ok, parseIsoDate, text } from '@/lib/buddgy/tools/writeKit'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import type { Currency, FinanceStore, IncomeEvent, IncomeRecurringFrequency, IncomeSource, IncomeSourceType } from '@/lib/store/types'
import { getMonthRange } from '@/lib/utils/calculations'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { buildOccurrences, expectedPerPayday, type IncomeOccurrence } from '@/lib/utils/incomeOccurrences'
import { localTodayISO } from '@/lib/utils/localDate'
import { deriveDefaultPaydays, sourcePaydayDays, toISODate } from '@/lib/utils/paydaySchedule'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { addMonths, format, parseISO } from 'date-fns'

/** Same as the income sheet writes: days a paycheck may drift before it reads as missed. */
const PAYDAY_DRIFT_DAYS = 7
const LIST_CAP = 15
const FREQS: IncomeRecurringFrequency[] = ['monthly', 'biweekly', 'weekly']
const ADDABLE_TYPES: IncomeSourceType[] = ['salary', 'bonus', 'side_hustle', 'rental', 'investment', 'gift', 'refund', 'other']
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const MAX_DAYS: Record<IncomeRecurringFrequency, number> = { monthly: 1, biweekly: 2, weekly: 4 }

const r2 = (n: number) => Math.round(n * 100) / 100
const errorText = (r: ProposeResult): string => (r.ok ? '' : r.error)

function validCurrency(s: FinanceStore, input: unknown, fallback: Currency): Currency | { error: ReturnType<typeof fail> } {
  const currency = (text(input, 8)?.toUpperCase() ?? fallback) as Currency
  if (!FIAT_CURRENCIES.includes(currency)) return { error: fail(`${currency} is not a supported currency.`) }
  if (tryConvertCurrency(1, currency, s.settings.baseCurrency, s.exchangeRates) === null) {
    return { error: fail(`No exchange rate from ${currency} to ${s.settings.baseCurrency}.`, 'Ask for the amount in the base currency.') }
  }
  return currency
}

function parseDays(raw: unknown, freq: IncomeRecurringFrequency, anchorFallback?: number): { days: number[]; derived: boolean } | { error: ReturnType<typeof fail> } {
  if (raw === undefined && anchorFallback === undefined) return { error: fail('Which day of the month is payday?', 'Ask the user, then send paydayDays.') }
  const list = raw === undefined ? [anchorFallback as number] : Array.isArray(raw) ? raw.map((d) => num(d)) : [undefined]
  if (list.length === 0 || list.some((d) => d === undefined || !Number.isInteger(d) || d < 1 || d > 31)) {
    return { error: fail('Payday days must be whole numbers from 1 to 31.') }
  }
  const days = [...new Set(list as number[])].sort((a, b) => a - b)
  if (days.length > MAX_DAYS[freq]) return { error: fail(`A ${freq} source has at most ${MAX_DAYS[freq]} payday${MAX_DAYS[freq] > 1 ? 's' : ''} a month.`) }
  if (days.length === 1 && freq !== 'monthly') return { days: deriveDefaultPaydays(days[0], freq), derived: true }
  return { days, derived: false }
}

function resolveSource(s: FinanceStore, ref: unknown): { source: IncomeSource } | { error: ReturnType<typeof fail> } {
  const hit = resolveByRefOrName(s.incomeSources, ref, (i) => i.name)
  if (hit.kind === 'one') return { source: hit.item }
  const choices = (hit.kind === 'many' ? hit.items : s.incomeSources).map((i) => ({ id: refOf(i.id), label: i.name }))
  return { error: fail(hit.kind === 'many' ? 'Several income sources match.' : 'No income source matches.', 'Find it with list_income first.', choices) }
}

const freqOf = (i: IncomeSource): IncomeRecurringFrequency => i.recurringFrequency ?? 'monthly'
const daysText = (days: number[] | null): string => (days ? days.join(', ') : '—')
const sourceDays = (i: IncomeSource): number[] | null => (i.isRecurring ? sourcePaydayDays(i) : null)

const isActive = (i: IncomeSource, todayISO: string): boolean => !i.effectiveEnd || i.effectiveEnd >= todayISO

const list_income: ReadImpl = (args, ctx) => {
  const s = fin()
  const month = typeof args.month === 'string' && MONTH_RE.test(args.month) ? args.month : ui().monthFilter
  const today = localTodayISO(ctx.now)
  const { start, end } = getMonthRange(month, s.settings.monthStartDay)
  const from = toISODate(start)
  const to = toISODate(end)
  const rows = s.incomeSources.slice(0, LIST_CAP).map((i) => ({
    ref: refOf(i.id),
    name: i.name,
    amount: r2(i.amount),
    cur: i.currency,
    freq: i.isRecurring ? freqOf(i) : 'one_time',
    type: i.sourceType ?? 'other',
    active: isActive(i, today),
    ...(i.isRecurring ? { days: sourceDays(i) } : {}),
    ...(i.isRecurring
      ? {
          paydays: buildOccurrences(i, s.incomeEvents, month, s.settings.monthStartDay, ctx.now).map((o) => ({
            date: o.dueDate,
            status: o.status,
            amount: r2(o.amount),
          })),
        }
      : {}),
  }))
  const oneTime = s.incomeEvents
    .filter((e) => !e.templateId && e.receivedDate >= from && e.receivedDate <= to && (e.status === 'confirmed' || e.status === 'partial'))
    .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate))
  return {
    month,
    currency: s.settings.baseCurrency,
    sources: rows,
    ...(s.incomeSources.length > LIST_CAP ? { more: s.incomeSources.length - LIST_CAP } : {}),
    oneTime: oneTime.slice(0, LIST_CAP).map((e) => ({ name: e.name, amount: r2(e.amount), cur: e.currency, date: e.receivedDate })),
    ...(oneTime.length > LIST_CAP ? { oneTimeMore: oneTime.length - LIST_CAP } : {}),
  }
}

function methodRow(s: FinanceStore, label: string, id: string): PreviewRow[] {
  const name = s.paymentMethods.find((m) => m.id === id)?.name
  return name ? [{ label, value: name }] : []
}

const add_income: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = incomeLabels(ctx.locale)
    const name = text(args.name, 60)
    if (!name) return fail('Income needs a name.')
    const amount = num(args.amount)
    if (amount === undefined || amount <= 0) return fail('The amount must be above zero.')
    const currency = validCurrency(s, args.currency, s.settings.baseCurrency)
    if (typeof currency === 'object') return currency.error
    const frequency = args.frequency as IncomeRecurringFrequency | 'one_time'
    const recurring = FREQS.includes(frequency as IncomeRecurringFrequency)
    if (!recurring && frequency !== 'one_time') return fail('Frequency must be monthly, biweekly, weekly or one_time.')
    const type = (args.type === undefined ? (recurring ? 'salary' : 'other') : args.type) as IncomeSourceType
    if (!ADDABLE_TYPES.includes(type)) return fail('Unknown income type.', `Use one of: ${ADDABLE_TYPES.join(', ')}.`)
    const method = resolvePaymentMethod(s, args.method)
    if ('error' in method) return method.error
    const notes = text(args.notes, 200)

    const common = { name, amount, currency, frequency, type, ...(method.id ? { method: refOf(method.id) } : {}), ...(notes ? { notes } : {}) }
    const rows: PreviewRow[] = [
      { label: L.name, value: name },
      { label: L.amount, value: money(amount, currency) },
      { label: L.frequency, value: L.frequencies[frequency] },
      { label: L.type, value: L.types[type] },
      ...methodRow(s, L.method, method.id),
    ]
    const fields: EditableField[] = [
      { key: 'name', label: L.name, kind: 'text', value: name },
      { key: 'amount', label: L.amount, kind: 'amount', value: String(amount), currency },
    ]

    if (recurring) {
      if (args.date !== undefined) return fail('A recurring source has no received date.', 'Use frequency one_time for money received once.')
      const parsed = parseDays(args.paydayDays, frequency as IncomeRecurringFrequency)
      if ('error' in parsed) return parsed.error
      rows.splice(3, 0, { label: L.paydays, value: daysText(parsed.days) })
      const duplicate = s.incomeSources.some((i) => i.isRecurring && i.name.trim().toLowerCase() === name.toLowerCase() && isActive(i, localTodayISO(ctx.now)))
      return ok(
        makeProposal({
          tool: 'add_income',
          args: { ...common, paydayDays: parsed.days },
          risk: 'approve',
          summary: `Pending approval: add recurring income ${name} ${money(amount, currency)} (${frequency}, days ${daysText(parsed.days)}).`,
          preview: {
            domain: 'income',
            tone: 'add',
            title: L.addRecurring,
            rows,
            fields,
            ...(parsed.derived ? { effect: L.derivedDays } : duplicate ? { effect: L.duplicateWarning } : {}),
          },
        }),
      )
    }

    if (args.paydayDays !== undefined) return fail('One-time income has no payday days.')
    const date = args.date === undefined ? localTodayISO(ctx.now) : parseIsoDate(args.date)
    if (!date) return fail('The date must be a real date like 2026-10-19.')
    rows.splice(3, 0, { label: L.dateReceived, value: date })
    fields.push({ key: 'date', label: L.dateReceived, kind: 'date', value: date })
    const duplicate = s.incomeEvents.some((e) => !e.templateId && e.receivedDate === date && e.amount === amount && e.name.trim().toLowerCase() === name.toLowerCase())
    return ok(
      makeProposal({
        tool: 'add_income',
        args: { ...common, date },
        risk: 'approve',
        summary: `Pending approval: add ${name} ${money(amount, currency)} received ${date}.`,
        preview: { domain: 'income', tone: 'add', title: L.addOneTime, rows, fields, ...(duplicate ? { effect: L.duplicateWarning } : {}) },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = add_income.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const a = again.proposal.args
    const s = fin()
    const method = resolvePaymentMethod(s, a.method)
    if ('error' in method) return { ok: false, error: 'That payment method no longer exists.' }
    const flag = s.settings.noIncomeDeclared
    const restoreFlag = () => fin().updateSettings({ noIncomeDeclared: flag })
    const name = a.name as string
    const common = {
      name,
      amount: a.amount as number,
      currency: a.currency as Currency,
      sourceType: a.type as IncomeSourceType,
      ...(a.notes ? { notes: a.notes as string } : {}),
      ...(method.id ? { paymentMethodId: method.id } : {}),
    }
    const message = `${name} · ${money(a.amount as number, a.currency as string)}`

    if (a.frequency === 'one_time') {
      const before = new Set(s.incomeEvents.map((e) => e.id))
      s.addIncomeEvent({ ...common, receivedDate: a.date as string, status: 'confirmed' })
      const created = fin().incomeEvents.find((e) => !before.has(e.id))
      return {
        ok: true,
        message,
        undo: created
          ? () => {
              fin().deleteIncomeEvent(created.id)
              restoreFlag()
            }
          : undefined,
      }
    }

    const freq = a.frequency as IncomeRecurringFrequency
    const days = a.paydayDays as number[]
    const before = new Set(s.incomeSources.map((i) => i.id))
    s.addIncomeSource({
      ...common,
      isRecurring: true,
      recurringFrequency: freq,
      dayOfMonth: days[0],
      ...(freq !== 'monthly' ? { paydayDays: days } : {}),
      paydayDriftDays: PAYDAY_DRIFT_DAYS,
    })
    const created = fin().incomeSources.find((i) => !before.has(i.id))
    return {
      ok: true,
      message,
      undo: created
        ? () => {
            fin().deleteIncomeSource(created.id)
            restoreFlag()
          }
        : undefined,
    }
  },
}

type SourcePatch = Partial<Pick<IncomeSource, 'name' | 'amount' | 'currency' | 'recurringFrequency' | 'dayOfMonth' | 'paydayDays' | 'sourceType' | 'paymentMethodId' | 'notes'>>

const lockedType = (i: IncomeSource): boolean =>
  Boolean(i.linkedDebtId || (i.linkedSavingsAccountId && (i.sourceType === 'savings' || i.sourceType === 'investment')))

const update_income: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = incomeLabels(ctx.locale)
    const hit = resolveSource(s, args.ref)
    if ('error' in hit) return hit.error
    const i = hit.source
    const rows: PreviewRow[] = []
    const patch: SourcePatch = {}

    const name = text(args.name, 60)
    if (name && name !== i.name) {
      patch.name = name
      rows.push({ label: L.name, before: i.name, value: name })
    }

    let amount = i.amount
    let currency = i.currency
    if (args.amount !== undefined) {
      const n = num(args.amount)
      if (n === undefined || n <= 0) return fail('The amount must be above zero.')
      amount = n
    }
    if (args.currency !== undefined) {
      const c = validCurrency(s, args.currency, i.currency)
      if (typeof c === 'object') return c.error
      currency = c
    }
    if (amount !== i.amount || currency !== i.currency) {
      if (tryConvertCurrency(1, currency, s.settings.baseCurrency, s.exchangeRates) === null) {
        return fail(`No exchange rate from ${currency} to ${s.settings.baseCurrency}.`)
      }
      patch.amount = amount
      patch.currency = currency
      rows.push({ label: L.amount, before: money(i.amount, i.currency), value: money(amount, currency) })
    }

    if (args.frequency !== undefined || args.paydayDays !== undefined) {
      if (!i.isRecurring) return fail('That is one-time income and has no paydays.')
      if (args.frequency !== undefined && !FREQS.includes(args.frequency as IncomeRecurringFrequency)) return fail('Frequency must be monthly, biweekly or weekly.')
      const freq = (args.frequency as IncomeRecurringFrequency | undefined) ?? freqOf(i)
      const current = sourceDays(i)
      const anchor = args.paydayDays === undefined ? (current?.[0] ?? i.dayOfMonth ?? 1) : undefined
      const parsed = parseDays(args.paydayDays, freq, anchor)
      if ('error' in parsed) return parsed.error
      const sameDays = current !== null && current.length === parsed.days.length && current.every((d, k) => d === parsed.days[k])
      if (freq !== freqOf(i) || !sameDays) {
        patch.recurringFrequency = freq
        patch.dayOfMonth = parsed.days[0]
        patch.paydayDays = freq === 'monthly' ? undefined : parsed.days
        if (freq !== freqOf(i)) rows.push({ label: L.frequency, before: L.frequencies[freqOf(i)], value: L.frequencies[freq] })
        rows.push({ label: L.paydays, before: daysText(current), value: daysText(parsed.days) })
      }
    }

    if (args.type !== undefined) {
      const type = args.type as IncomeSourceType
      if (!ADDABLE_TYPES.includes(type)) return fail('Unknown income type.', `Use one of: ${ADDABLE_TYPES.join(', ')}.`)
      if (type !== (i.sourceType ?? 'other')) {
        if (lockedType(i)) return fail('This source is linked to a debt or savings account, so its type cannot change.')
        patch.sourceType = type
        rows.push({ label: L.type, before: L.types[i.sourceType ?? 'other'], value: L.types[type] })
      }
    }

    if (args.method !== undefined) {
      const method = resolvePaymentMethod(s, args.method)
      if ('error' in method) return method.error
      if (method.id && method.id !== i.paymentMethodId) {
        patch.paymentMethodId = method.id
        const nameOf = (id?: string) => s.paymentMethods.find((m) => m.id === id)?.name ?? '—'
        rows.push({ label: L.method, before: nameOf(i.paymentMethodId), value: nameOf(method.id) })
      }
    }

    const notes = text(args.notes, 200)
    if (notes !== undefined && notes !== (i.notes ?? '')) {
      patch.notes = notes
      rows.push({ label: L.notes, before: i.notes ?? '—', value: notes })
    }
    if (rows.length === 0) return fail('Nothing would change.')

    return ok(
      makeProposal({
        tool: 'update_income',
        args: { ref: refOf(i.id), ...Object.fromEntries(Object.entries(args).filter(([k, v]) => k !== 'ref' && v !== undefined)) },
        risk: 'approve',
        summary: `Pending approval: change ${i.name}.`,
        preview: {
          domain: 'income',
          tone: 'change',
          title: `${L.changeIncome}: ${i.name}`,
          rows,
          fields: [
            { key: 'name', label: L.name, kind: 'text', value: patch.name ?? i.name },
            { key: 'amount', label: L.amount, kind: 'amount', value: String(amount), currency },
          ],
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = update_income.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const s = fin()
    const hit = resolveSource(s, again.proposal.args.ref)
    if ('error' in hit) return { ok: false, error: 'That income source no longer exists.' }
    const i = hit.source
    const a = again.proposal.args
    const patch: SourcePatch = {}
    const name = text(a.name, 60)
    if (name) patch.name = name
    if (a.amount !== undefined) patch.amount = num(a.amount)
    if (a.currency !== undefined) patch.currency = text(a.currency, 8)?.toUpperCase() as Currency
    if (a.frequency !== undefined || a.paydayDays !== undefined) {
      const freq = (a.frequency as IncomeRecurringFrequency | undefined) ?? freqOf(i)
      const anchor = a.paydayDays === undefined ? (sourceDays(i)?.[0] ?? i.dayOfMonth ?? 1) : undefined
      const parsed = parseDays(a.paydayDays, freq, anchor)
      if ('error' in parsed) return { ok: false, error: errorText(parsed.error) }
      patch.recurringFrequency = freq
      patch.dayOfMonth = parsed.days[0]
      patch.paydayDays = freq === 'monthly' ? undefined : parsed.days
    }
    if (a.type !== undefined) patch.sourceType = a.type as IncomeSourceType
    if (a.method !== undefined) {
      const m = resolvePaymentMethod(s, a.method)
      if (!('error' in m) && m.id) patch.paymentMethodId = m.id
    }
    if (a.notes !== undefined) patch.notes = text(a.notes, 200)
    const previous: Record<string, unknown> = {}
    for (const key of Object.keys(patch) as (keyof SourcePatch)[]) previous[key] = i[key]
    s.updateIncomeSource(i.id, patch)
    return { ok: true, message: patch.name ?? i.name, undo: () => fin().updateIncomeSource(i.id, previous as Partial<IncomeSource>) }
  },
}

const delete_income: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = incomeLabels(ctx.locale)
    const hit = resolveSource(s, args.ref)
    if ('error' in hit) return hit.error
    const i = hit.source
    return ok(
      makeProposal({
        tool: 'delete_income',
        args: { ref: refOf(i.id) },
        risk: 'strong',
        summary: `Pending approval: delete income source ${i.name}.`,
        preview: {
          domain: 'income',
          tone: 'danger',
          title: `${L.deleteIncome}: ${i.name}`,
          rows: [
            { label: L.amount, value: money(i.amount, i.currency) },
            { label: L.frequency, value: L.frequencies[i.isRecurring ? freqOf(i) : 'one_time'] },
            { label: L.type, value: L.types[i.sourceType ?? 'other'] },
          ],
          ...(s.incomeSources.length === 1 ? { effect: L.lastSource } : {}),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = delete_income.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const hit = resolveSource(fin(), again.proposal.args.ref)
    if ('error' in hit) return { ok: false, error: 'That income source no longer exists.' }
    const removed = hit.source
    const before = fin().incomeSources
    const flag = fin().settings.noIncomeDeclared
    fin().deleteIncomeSource(removed.id)
    return {
      ok: true,
      message: removed.name,
      undo: () => {
        useFinanceStore.setState((st) => ({
          incomeSources: restoreRows(st.incomeSources, before, new Set([removed.id])),
          ...(st.settings.noIncomeDeclared !== flag ? { settings: { ...st.settings, noIncomeDeclared: flag } } : {}),
        }))
      },
    }
  },
}

function occurrencesFor(s: FinanceStore, source: IncomeSource, month: string, now: Date): IncomeOccurrence[] {
  return buildOccurrences(source, s.incomeEvents, month, s.settings.monthStartDay, now)
}

type PaydayPlan =
  | { ok: false; res: ReturnType<typeof fail> }
  | {
      ok: true
      source: IncomeSource
      current: IncomeOccurrence
      existing?: IncomeEvent
      amount: number
      receivedDate: string
      status: 'confirmed' | 'partial'
      expected: number
    }

function planPayday(args: Record<string, unknown>, ctx: ToolContext): PaydayPlan {
  const s = fin()
  const hit = resolveSource(s, args.ref)
  if ('error' in hit) return { ok: false, res: hit.error }
  const source = hit.source
  if (!source.isRecurring) return { ok: false, res: fail('That is one-time income and has no paydays.') }
  const screenMonth = ui().monthFilter

  let current: IncomeOccurrence | undefined
  if (args.payday === undefined) {
    const open = occurrencesFor(s, source, screenMonth, ctx.now).filter((o) => !o.eventId)
    if (open.length === 0) return { ok: false, res: fail('Every payday this cycle is already logged.', 'Send payday to edit a logged one.') }
    if (open.length > 1) {
      return { ok: false, res: fail('Several paydays are open.', 'Ask which payday was received.', open.map((o) => ({ id: o.dueDate, label: `${o.dueDate} (${o.status})` }))) }
    }
    current = open[0]
  } else {
    const payday = parseIsoDate(args.payday)
    if (!payday) return { ok: false, res: fail('The payday must be a real date like 2026-10-05.') }
    const around = [screenMonth, ...[-1, 0, 1].map((d) => format(addMonths(parseISO(`${payday.slice(0, 7)}-01`), d), 'yyyy-MM'))]
    for (const month of new Set(around)) {
      current = occurrencesFor(s, source, month, ctx.now).find((o) => o.dueDate === payday)
      if (current) break
    }
    if (!current) {
      const open = occurrencesFor(s, source, screenMonth, ctx.now)
      return { ok: false, res: fail(`${source.name} has no payday on ${payday}.`, 'Pick one of the scheduled paydays.', open.map((o) => ({ id: o.dueDate, label: `${o.dueDate} (${o.status})` }))) }
    }
  }

  const existing = s.incomeEvents.find((e) => e.id === current.eventId) ?? s.incomeEvents.find((e) => e.templateId === source.id && e.occurrenceDate === current.dueDate)
  if (!existing && !current.actionable) return { ok: false, res: fail('An earlier payday is still waiting.', 'Mark that payday first.') }

  const expected = expectedPerPayday(source)
  const amount = args.amount === undefined ? expected : num(args.amount)
  if (amount === undefined || amount <= 0) return { ok: false, res: fail('The amount must be above zero.') }
  const receivedDate = args.date === undefined ? (existing?.receivedDate ?? localTodayISO(ctx.now)) : parseIsoDate(args.date)
  if (!receivedDate) return { ok: false, res: fail('The date must be a real date like 2026-10-19.') }
  if (existing && amount === existing.amount && receivedDate === existing.receivedDate && current.status !== 'missed') {
    return { ok: false, res: fail('That payday is already logged this way.') }
  }
  return { ok: true, source, current, existing, amount, receivedDate, status: amount >= expected ? 'confirmed' : 'partial', expected }
}

const mark_payday_received: WriteImpl = {
  propose(args, ctx) {
    const L = incomeLabels(ctx.locale)
    const plan = planPayday(args, ctx)
    if (!plan.ok) return plan.res
    const { source, current, existing, amount, receivedDate, status, expected } = plan
    const cur = source.currency
    const statusText = status === 'confirmed' ? L.received : L.partial(money(r2(expected - amount), cur))
    return ok(
      makeProposal({
        tool: 'mark_payday_received',
        args: { ref: refOf(source.id), payday: current.dueDate, amount, date: receivedDate },
        risk: 'approve',
        summary: `Pending approval: log ${source.name} payday ${current.dueDate} as ${status === 'confirmed' ? 'received' : 'partial'} (${money(amount, cur)}).`,
        preview: {
          domain: 'income',
          tone: existing ? 'change' : 'add',
          title: `${L.markReceived}: ${source.name}`,
          rows: [
            { label: L.payday, value: current.dueDate },
            { label: L.amount, value: money(amount, cur), ...(existing ? { before: money(existing.amount, cur) } : {}) },
            { label: L.dateReceived, value: receivedDate, ...(existing && existing.receivedDate !== receivedDate ? { before: existing.receivedDate } : {}) },
            { label: L.status, value: statusText },
          ],
          fields: [
            { key: 'amount', label: L.amount, kind: 'amount', value: String(amount), currency: cur },
            { key: 'date', label: L.dateReceived, kind: 'date', value: receivedDate },
          ],
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const plan = planPayday(proposal.args, ctx)
    if (!plan.ok) return { ok: false, error: errorText(plan.res) }
    const { source, current, existing, amount, receivedDate, status } = plan
    const s = fin()
    const message = `${source.name} · ${money(amount, source.currency)}`
    if (existing) {
      const previous = { amount: existing.amount, status: existing.status, receivedDate: existing.receivedDate, occurrenceDate: existing.occurrenceDate }
      s.updateIncomeEvent(existing.id, { amount, status, receivedDate, occurrenceDate: current.dueDate })
      return { ok: true, message, undo: () => fin().updateIncomeEvent(existing.id, previous) }
    }
    const flag = s.settings.noIncomeDeclared
    const before = new Set(s.incomeEvents.map((e) => e.id))
    s.addIncomeEvent({
      templateId: source.id,
      name: source.name,
      amount,
      currency: source.currency,
      sourceType: source.sourceType,
      receivedDate,
      occurrenceDate: current.dueDate,
      status,
      ...(source.paymentMethodId ? { paymentMethodId: source.paymentMethodId } : {}),
    })
    const created = fin().incomeEvents.find((e) => !before.has(e.id))
    return {
      ok: true,
      message,
      undo: created
        ? () => {
            fin().deleteIncomeEvent(created.id)
            fin().updateSettings({ noIncomeDeclared: flag })
          }
        : undefined,
    }
  },
}

export const incomeTools = defineTools(incomeSpecs, { list_income, add_income, update_income, delete_income, mark_payday_received })
