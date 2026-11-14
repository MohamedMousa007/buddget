/**
 * The S2c closing replay (docs/launch/S2b2-second-review.md section 7). Unlike the earlier per-message replay this one
 * is ORDER-AWARE: it feeds every stored message through today's real booking code, `createSmsTransaction`, in arrival
 * order per user, against an in-memory service, and leaves the outcomes to be checked.
 *
 * It replays the DISPATCH stage only (what is booked, paired and stamped), not the parse tiers: amounts, tails and kinds
 * come from the stored structured columns. The stored text is the masked body, so anything that needs real digits in the
 * body (a payment reference, a running balance) is unknown here, and the stored kind is the APPLIED kind.
 *
 * The in-memory service has real filter semantics. A table or RPC it does not implement throws instead of answering
 * empty, so a dependency this harness does not model shows up as a failure and not as a silent pass.
 */
import { computeBodyHash, captureSecond, smsLocalDay } from '@/lib/sms/ingestGuards'
import { standingCopies, secondCopyVerdict, SECOND_COPY_WINDOW_MS, type CopyRow } from '@/lib/sms/captureGuard'
import { createSmsTransaction, extractIpnReference, type SmsTxResult } from '@/lib/sms/dispatch'
import type { SmsRowData } from '@/lib/sms/createSmsExpense'
import { findRefundOriginal, isDeclineMessage, type RefundRule } from '@/lib/sms/refundMatch'
import { pairGuardsAllow, type PairLegFacts } from '@/lib/sms/pairing'
import type { SmsFlag } from '@/lib/sms/smsFlags'
import type { ServiceClient } from '@/lib/supabase/service'

export type Row = Record<string, unknown>

/** The local export written from scripts/qa/sms-s2c-replay-inputs.sql. Every log value is text. */
export interface ReplayExport {
  logCols: string[]
  logs: (string | null)[][]
  pms: unknown[][]
  debts: unknown[][]
  answers: unknown[][]
  liveExpCols: string[]
  liveExp: unknown[][]
  liveInc: unknown[][]
  created: Record<string, string>
}

export interface LogIn {
  id: string
  user: string
  kind: string | null
  status: string | null
  parseMethod: string | null
  amount: number | null
  currency: string | null
  accountLast4: string | null
  counterpartyLast4: string | null
  counterpartyHash: string | null
  counterpartyIsSelf: boolean | null
  referenceHash: string | null
  device: string | null
  receivedAt: string
  createdAt: string
  isDuplicate: boolean
  awaitingConfirmation: boolean
  paired: string | null
  merchantNormalized: string | null
  cleanTitle: string | null
  bankName: string | null
  sender: string | null
  legDirection: string | null
  body: string | null
  matchedTemplate: string | null
  merchant: string | null
  category: string | null
  liveExpense: boolean
  liveIncome: boolean
  /** The stored log row points at a booked expense or income id (which may belong to another message). */
  storedMoneyId: boolean
}

const bool = (v: string | null): boolean | null => (v === null ? null : v === 'true')

export function readLogs(data: ReplayExport): LogIn[] {
  const ix = (n: string): number => {
    const i = data.logCols.indexOf(n)
    if (i < 0) throw new Error(`closingReplay: export has no column ${n}`)
    return i
  }
  const c = Object.fromEntries(data.logCols.map((n) => [n, ix(n)])) as Record<string, number>
  return data.logs.map((r) => ({
    id: r[c.id] as string,
    user: r[c.u] as string,
    kind: r[c.kind],
    status: r[c.status],
    parseMethod: r[c.parse_method],
    amount: r[c.amount] === null ? null : Number(r[c.amount]),
    currency: r[c.currency],
    accountLast4: r[c.account_last4],
    counterpartyLast4: r[c.counterparty_last4],
    counterpartyHash: r[c.counterparty_hash],
    counterpartyIsSelf: bool(r[c.counterparty_is_self]),
    referenceHash: r[c.reference_hash],
    device: r[c.device],
    receivedAt: r[c.received_at] as string,
    createdAt: data.created[r[c.id] as string] ?? (r[c.received_at] as string),
    isDuplicate: r[c.is_duplicate] === 'true',
    awaitingConfirmation: r[c.awaiting_confirmation] === 'true',
    paired: r[c.paired],
    merchantNormalized: r[c.merchant_normalized],
    cleanTitle: r[c.clean_title],
    bankName: r[c.bank_name],
    sender: r[c.sender],
    legDirection: r[c.leg_direction],
    body: r[c.masked_body],
    matchedTemplate: r[c.matched_template],
    merchant: r[c.merchant],
    category: r[c.category],
    liveExpense: r[c.live_expense] === 'true',
    liveIncome: r[c.live_income] === 'true',
    storedMoneyId: r[c.has_expense_id] === 'true' || r[c.has_income_id] === 'true',
  }))
}

// ---------------------------------------------------------------------------------------------------------------
// The in-memory service
// ---------------------------------------------------------------------------------------------------------------

interface Store {
  tables: Record<string, Row[]>
  seq: number
  rpcLog: Array<{ fn: string; args: Record<string, unknown> }>
}

/**
 * Tables `createSmsTransaction` reads that the export does not carry. They answer empty ON PURPOSE and are reported:
 * the user's salary templates, subscriptions, own names and merchant memory are not in the export.
 */
const UNEXPORTED_EMPTY_TABLES = ['merchant_category_overrides', 'merchant_categories', 'income_sources', 'user_settings', 'profiles', 'subscriptions']
const IMPLEMENTED_TABLES = ['sms_parse_log', 'expenses', 'income_events', 'payment_methods', 'debts', 'debt_payments', 'sms_own_transfer_answers']

interface PgError { code: string; message: string }
const pgError = (code: string, message: string): PgError => ({ code, message })

const cmp = (a: unknown, b: unknown): number => {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a < b ? -1 : a > b ? 1 : 0
}

const likeToRegExp = (pattern: string): RegExp =>
  new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i')

function uniqueViolation(store: Store, name: string, row: Row): PgError | null {
  const live = (r: Row) => r.deleted_at == null
  if (name === 'sms_parse_log' && store.tables[name].some((r) => r.id === row.id)) return pgError('23505', 'sms_parse_log pkey')
  if (name === 'expenses' && row.sms_log_id != null && live(row)) {
    const fee = row.description === 'Transfer fee'
    if (store.tables[name].some((r) => live(r) && r.sms_log_id === row.sms_log_id && (r.description === 'Transfer fee') === fee)) {
      return pgError('23505', 'expenses_sms_log_unique_idx')
    }
  }
  if ((name === 'income_events' || name === 'debt_payments') && row.sms_log_id != null && live(row)) {
    if (store.tables[name].some((r) => live(r) && r.sms_log_id === row.sms_log_id)) return pgError('23505', `${name}_sms_log_unique_idx`)
  }
  if (name === 'payment_methods' && row.provisional === true && live(row)) {
    const key = (r: Row) => `${r.user_id}|${String(r.name).toLowerCase()}|${r.currency}`
    if (store.tables[name].some((r) => r.provisional === true && live(r) && key(r) === key(row))) return pgError('23505', 'provisional account unique index')
  }
  return null
}

const DEFAULTS: Record<string, () => Row> = {
  expenses: () => ({ deleted_at: null, refunded_at: null, refund_kind: null, refund_sms_log_id: null, retracted_by_sms_log_id: null, sms_flags: null, to_payment_method_id: null, payment_method_id: null }),
  income_events: () => ({ deleted_at: null, retracted_by_sms_log_id: null, sms_flags: null }),
  payment_methods: () => ({ deleted_at: null, closed_at: null, last4_aliases: [], provisional: false, is_default: false }),
  debt_payments: () => ({ deleted_at: null }),
}

function makeBuilder(store: Store, name: string): unknown {
  if (UNEXPORTED_EMPTY_TABLES.includes(name)) store.tables[name] ??= []
  const rows = store.tables[name]
  if (!rows) throw new Error(`closingReplay: table "${name}" is not implemented by the in-memory service`)

  const filters: ((r: Row) => boolean)[] = []
  const sorts: { col: string; asc: boolean }[] = []
  let op: 'select' | 'insert' | 'update' | 'upsert' = 'select'
  let payload: Row | Row[] = {}
  let selected = false
  let max = Infinity
  let single: 'single' | 'maybe' | null = null

  const finish = (hit: Row[]): { data: unknown; error: PgError | null } => {
    if (single) {
      if (hit.length > 1) return { data: null, error: pgError('PGRST116', 'multiple rows returned for a single-row request') }
      if (hit.length === 0) return { data: null, error: single === 'single' ? pgError('PGRST116', 'no rows returned for a single-row request') : null }
      return { data: hit[0], error: null }
    }
    return { data: selected || op === 'select' ? hit : null, error: null }
  }

  const exec = (): { data: unknown; error: PgError | null } => {
    if (op === 'insert') {
      const inserted: Row[] = []
      for (const p of Array.isArray(payload) ? payload : [payload]) {
        store.seq += 1
        const row: Row = { id: `${name}-${store.seq}`, created_at: `2026-11-14T00:00:00.${String(store.seq).padStart(6, '0')}Z`, ...(DEFAULTS[name]?.() ?? {}), ...p }
        const dup = uniqueViolation(store, name, row)
        if (dup) return { data: null, error: dup }
        rows.push(row)
        inserted.push(row)
      }
      return finish(inserted)
    }
    if (op === 'upsert') {
      const p = payload as Row
      if (name !== 'sms_own_transfer_answers') throw new Error(`closingReplay: upsert on "${name}" is not implemented`)
      const key = (r: Row) => `${r.user_id}|${r.account_a}|${r.account_b}`
      const at = rows.findIndex((r) => key(r) === key(p))
      if (at >= 0) rows[at] = { ...p }
      else rows.push({ ...p })
      return { data: null, error: null }
    }
    let hit = rows.filter((r) => filters.every((f) => f(r)))
    if (op === 'update') {
      hit.forEach((r) => Object.assign(r, payload))
      return finish(hit)
    }
    for (const { col, asc } of [...sorts].reverse()) hit = [...hit].sort((a, b) => cmp(a[col], b[col]) * (asc ? 1 : -1))
    return finish(hit.slice(0, max))
  }

  const known: Record<string, (...a: never[]) => unknown> = {}
  const b: unknown = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') return (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve().then(exec).then(res, rej)
      const fn = known[prop]
      if (!fn) throw new Error(`closingReplay: query method .${prop}() is not implemented by the in-memory service (table ${name})`)
      return fn
    },
  })
  const add = (n: string, fn: (...a: never[]) => unknown) => { known[n] = fn }
  add('select', () => { selected = true; return b })
  add('insert', ((p: Row | Row[]) => { op = 'insert'; payload = p; return b }) as never)
  add('update', ((p: Row) => { op = 'update'; payload = p; return b }) as never)
  add('upsert', ((p: Row) => { op = 'upsert'; payload = p; return b }) as never)
  add('eq', ((c: string, v: unknown) => { filters.push((r) => r[c] != null && v != null && r[c] === v); return b }) as never)
  add('neq', ((c: string, v: unknown) => { filters.push((r) => r[c] != null && r[c] !== v); return b }) as never)
  add('is', ((c: string, v: unknown) => { filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return b }) as never)
  add('not', ((c: string, o: string, v: unknown) => {
    if (o === 'is') filters.push((r) => (v === null ? r[c] != null : r[c] !== v))
    else if (o === 'eq') filters.push((r) => r[c] != null && r[c] !== v)
    else if (o === 'in') {
      const list = String(v).replace(/^\(|\)$/g, '').split(',')
      filters.push((r) => r[c] != null && !list.includes(String(r[c])))
    } else throw new Error(`closingReplay: .not(..., "${o}") is not implemented`)
    return b
  }) as never)
  add('in', ((c: string, vs: unknown[]) => { filters.push((r) => r[c] != null && vs.includes(r[c])); return b }) as never)
  add('gte', ((c: string, v: string | number) => { filters.push((r) => r[c] != null && (r[c] as string | number) >= v); return b }) as never)
  add('lte', ((c: string, v: string | number) => { filters.push((r) => r[c] != null && (r[c] as string | number) <= v); return b }) as never)
  add('ilike', ((c: string, pattern: string) => { const re = likeToRegExp(pattern); filters.push((r) => r[c] != null && re.test(String(r[c]))); return b }) as never)
  add('order', ((col: string, o?: { ascending?: boolean }) => { sorts.push({ col, asc: o?.ascending !== false }); return b }) as never)
  add('limit', ((n: number) => { max = n; return b }) as never)
  add('maybeSingle', () => { single = 'maybe'; return Promise.resolve(exec()) })
  add('single', () => { single = 'single'; return Promise.resolve(exec()) })

  return b
}

// --- the RPCs --------------------------------------------------------------------------------------------------

/** Mirror of public.sms_last4_match (migration 0271). */
function tailMatch(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false
  const n = Math.min(a.length, b.length)
  return n >= 3 && a.slice(-n) === b.slice(-n)
}

const factsOf = (r: Row): PairLegFacts => ({
  id: r.id as string,
  kind: (r.kind as string | null) ?? null,
  legDirection: (r.leg_direction as 'credit' | 'debit' | null) ?? null,
  status: (r.status as string | null) ?? null,
  isDuplicate: (r.is_duplicate as boolean | null) ?? false,
  awaitingConfirmation: (r.awaiting_confirmation as boolean | null) ?? false,
  accountLast4: (r.account_last4 as string | null) ?? null,
  currency: (r.currency as string | null) ?? null,
  amount: (r.amount as number | null) ?? null,
  counterpartyLast4: (r.counterparty_last4 as string | null) ?? null,
  counterpartyHash: (r.counterparty_hash as string | null) ?? null,
  counterpartyIsSelf: (r.counterparty_is_self as boolean | null) ?? null,
  referenceHash: (r.reference_hash as string | null) ?? null,
})

const sqlDirection = (kind: unknown, published: unknown): string | null =>
  kind === 'instant_transfer_in' || kind === 'cc_payoff' ? 'credit' : kind === 'instant_transfer_out' ? 'debit' : ((published as string | null) ?? null)

/** Mirror of public.sms_repayment_fee_proven (migration 0271). */
function repaymentFeeProven(self: Row, sib: Row, selfKind: string | null): boolean {
  const selfIsCard = (selfKind ?? (self.kind as string | null) ?? '') === 'cc_payoff'
  const sibIsCard = (sib.kind ?? '') === 'cc_payoff'
  if (selfIsCard === sibIsCard) return false
  const fundingDigits = selfIsCard ? sib.counterparty_last4 : self.counterparty_last4
  const cardDigits = selfIsCard ? self.account_last4 : sib.account_last4
  const len = (v: unknown) => (typeof v === 'string' ? v.length : 0)
  return (len(fundingDigits) >= 3 && len(cardDigits) >= 3 && tailMatch(fundingDigits, cardDigits)) ||
    (self.reference_hash != null && self.reference_hash === sib.reference_hash)
}

/**
 * sms_try_pair as migration 0271 defines it: the same window, kind list, amount and fee rule, reference clause,
 * registered-sibling clause, currency-exchange clause, claimed-once rule and sibling id, with the refusals of guards
 * c to f taken from `pairGuardsAllow` (the pure copy the migration says it mirrors).
 * The reference clause matches the stored text, which here is the masked body: a reference is masked away, so a
 * reference pairing cannot occur in this replay.
 */
function smsTryPair(store: Store, p: Record<string, unknown>): { data: unknown[]; error: PgError | null } {
  const logs = store.tables.sms_parse_log
  const self = logs.find((l) => l.id === p.p_log_id)
  if (!self) throw new Error(`closingReplay: sms_try_pair for a log that is not stored (${String(p.p_log_id)})`)
  if (self.paired_log_id) return { data: [], error: null }
  const at = Date.parse(p.p_received_at as string)
  const windowMs = (p.p_window_seconds as number) * 1000
  const kinds = p.p_match_kinds as string[]
  const reference = (p.p_reference as string | undefined) ?? null
  const selfKind = (p.p_self_kind as string | undefined) ?? null
  const tolerance = (p.p_amount_tolerance as number | undefined) ?? 0
  const requireEqual = p.p_require_equal_amount === true
  const requireRegistered = p.p_require_registered_sibling === true
  const direction = (p.p_direction as string | undefined) ?? null
  const currency = (p.p_currency as string | undefined) ?? null
  const selfDirection = direction ?? sqlDirection(self.kind, self.leg_direction)
  const selfCurrency = currency ?? ((self.currency as string | null) ?? null)
  const methods = store.tables.payment_methods

  const hit = logs
    .filter((s) => s.user_id === p.p_user_id && s.id !== self.id && !s.paired_log_id && s.parsed_ok === true && kinds.includes(s.kind as string))
    .filter((s) => !s.is_duplicate && s.status !== 'failed' && s.status !== 'rejected' && !s.awaiting_confirmation)
    .filter((s) => !p.p_sibling_id || s.id === p.p_sibling_id)
    .filter((s) => Math.abs(Date.parse(s.received_at as string) - at) <= windowMs)
    .filter((s) => {
      if (reference) return String(s.raw_body ?? '').toLowerCase().includes(reference.toLowerCase())
      if (!requireEqual) return true
      const allow = requireRegistered || repaymentFeeProven(self, s, selfKind) ? tolerance : 0
      return Math.abs((s.amount as number) - (p.p_amount as number)) <= allow
    })
    .filter((s) => !requireRegistered || methods.filter((m) => m.user_id === p.p_user_id && m.deleted_at == null && tailMatch(m.last4, s.account_last4)).length === 1)
    .filter((s) => selfKind !== 'currency_exchange' || (!!direction && !!s.leg_direction && s.leg_direction !== direction && !!currency && !!s.currency && String(s.currency).toUpperCase() !== currency.toUpperCase()))
    .filter((s) => pairGuardsAllow(factsOf(self), factsOf(s), { selfKind, selfDirection: selfDirection as 'credit' | 'debit' | null, selfCurrency, amountTolerance: tolerance }))
    .sort((a, b) => Math.abs(Date.parse(a.received_at as string) - at) - Math.abs(Date.parse(b.received_at as string) - at))[0]
  if (!hit) return { data: [], error: null }
  hit.paired_log_id = self.id
  self.paired_log_id = hit.id
  return { data: [{ sibling_id: hit.id, sibling_kind: hit.kind, sibling_expense_id: hit.expense_id ?? null, sibling_income_id: hit.income_id ?? null, sibling_status: hit.status }], error: null }
}

/** add_sms_debt_payment_with_expense as migration 0210 defines it (idempotent on the log id, overpay guard, auto-clear). */
function addDebtPaymentWithExpense(store: Store, p: Record<string, unknown>): { data: unknown; error: PgError | null } {
  const logId = p.p_sms_log_id as string
  const userId = p.p_user_id as string
  const pay = p.p_payment as Record<string, unknown>
  const exp = p.p_expense as Record<string, unknown>
  if (!store.tables.sms_parse_log.some((l) => l.id === logId && l.user_id === userId)) return { data: null, error: pgError('P0001', 'sms log not found or not owned') }
  const debt = store.tables.debts.find((d) => d.id === pay.debt_id && d.deleted_at == null)
  if (!debt || debt.user_id !== userId) return { data: null, error: pgError('P0001', 'Debt not found or not owned by user') }
  const debtPayments = store.tables.debt_payments
  const expenses = store.tables.expenses
  let payRow = debtPayments.find((r) => r.sms_log_id === logId && r.user_id === userId && r.deleted_at == null)
  let expRow = expenses.find((r) => r.sms_log_id === logId && r.user_id === userId && r.deleted_at == null && r.description !== 'Transfer fee')
  const existed = !!payRow && !!expRow
  const newAmount = Number(pay.amount_in_debt_unit ?? pay.amount)
  const paidOf = () => debtPayments.filter((r) => r.debt_id === debt.id && r.deleted_at == null).reduce((s, r) => s + Number(r.amount_in_debt_unit ?? r.amount), 0)
  if (!payRow) {
    if (debt.debt_type !== 'credit_card') {
      const total = Number(debt.starting_balance ?? debt.amount)
      if (total > 0 && paidOf() + newAmount > total + 0.01) return { data: { outcome: 'overpay', remaining: Math.max(total - paidOf(), 0) }, error: null }
    }
    store.seq += 1
    payRow = { id: `debt_payments-${store.seq}`, user_id: userId, deleted_at: null, sms_log_id: logId, ...pay }
    debtPayments.push(payRow)
  }
  if (!expRow) {
    store.seq += 1
    expRow = { id: `expenses-${store.seq}`, ...DEFAULTS.expenses(), user_id: userId, sms_log_id: logId, is_debt_payment: true, linked_debt_id: debt.id, linked_debt_payment_id: payRow.id, ...exp }
    expenses.push(expRow)
  }
  let cleared = false
  if (debt.debt_type !== 'credit_card' && debt.status === 'active') {
    const total = Number(debt.starting_balance ?? debt.amount)
    if (total > 0 && paidOf() >= total - 0.005) { debt.status = 'cleared'; cleared = true }
  }
  return { data: { outcome: existed ? 'replayed' : 'created', debt_payment_id: payRow.id, expense_id: expRow.id, debt_cleared: cleared }, error: null }
}

function makeService(store: Store): ServiceClient {
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    store.rpcLog.push({ fn, args })
    if (fn === 'sms_try_pair') return smsTryPair(store, args)
    if (fn === 'add_sms_debt_payment_with_expense') return addDebtPaymentWithExpense(store, args)
    // Health accounting and the shared merchant memory change no money row, so they are recorded and answer nothing.
    if (fn === 'bump_sms_template_failure' || fn === 'upsert_merchant_category') return { data: null, error: null }
    throw new Error(`closingReplay: RPC "${fn}" is not implemented by the in-memory service`)
  }
  return { from: (name: string) => makeBuilder(store, name), rpc } as unknown as ServiceClient
}

// ---------------------------------------------------------------------------------------------------------------
// The replay
// ---------------------------------------------------------------------------------------------------------------

export type KindSourceMode = 'stored' | 'model'

export interface ReplayOptions {
  /**
   * How a stored `own_transfer` row's kind is treated. 'stored': dispatch derived it (kindSource 'code'). 'model': for a
   * row whose parse method is not fully_curated the model asserted it (kindSource 'model'). Every other kind follows the
   * route's rule in both modes: only fully_curated proves a kind.
   */
  ownTransfer: KindSourceMode
  /**
   * What the dispatcher reads as the message text. 'masked' is the stored text exactly (digits are '#'). 'zeros' turns a long run of
   * '#' (the mask for four or more digits) into four zeros and every other '#' into one zero, so code that needs digits to match (the ledger sign after an amount) can read the wording again; the
   * stored copy that the reference clause searches stays masked, so no two references can be made to look alike.
   */
  digits?: 'masked' | 'zeros'
  /** Only these users (all when omitted). */
  users?: string[]
  /** Process these two messages in swapped order. */
  swap?: [string, string]
  /** Advances the fake clock (the pairing code sleeps; the caller mocks setTimeout and passes `vi.advanceTimersByTimeAsync`). */
  tick: (ms: number) => Promise<unknown>
}

export type SkipReason = 'not_a_transaction' | 'failed_before_parse' | 'no_kind_or_amount' | 'live_duplicate_not_caught_by_guard'

export interface Outcome {
  outcome: SmsTxResult['outcome']
  kind: string | null
  expenseId: string | null
  incomeId: string | null
  debtPaymentId: string | null
  kindSource: 'code' | 'model'
  /** True when the row first waited for the user and was dispatched again as confirmed (its live status says the user tapped it). */
  confirmedPass: boolean
  error: string | null
}

export interface Refusal { of: string; rule: 'same_capture' | 'proven_copy' }

export interface ReplayRun {
  store: Store
  outcomes: Map<string, Outcome>
  skipped: Map<string, SkipReason>
  refused: Map<string, Refusal>
  /** Flagged row id to the earlier message whose text it repeats. */
  possibleDuplicate: Map<string, string>
  refundRule: Map<string, RefundRule | null>
  templateOverrides: string[]
  dispatched: number
  total: number
}

function buildStore(data: ReplayExport, users: Set<string>): Store {
  const store: Store = { tables: {}, seq: 0, rpcLog: [] }
  for (const t of IMPLEMENTED_TABLES) store.tables[t] = []
  data.pms.forEach((p, i) => {
    const [u, id, name, type, currency, last4, aliases, provisional, closed, hasParent, excluded, trackSms, isDefault] = p as [string, string, string, string, string, string | null, string[], boolean, boolean, boolean, boolean, boolean, boolean]
    if (!users.has(u)) return
    store.tables.payment_methods.push({
      id, user_id: u, name, type, currency, last4, last4_aliases: aliases, provisional, closed_at: closed ? '2026-01-01T00:00:00.000Z' : null,
      deleted_at: null, parent_id: hasParent ? 'parent' : null, excluded, track_sms: trackSms, is_default: isDefault, created_at: `2026-01-01T00:00:00.${String(i).padStart(6, '0')}Z`,
    })
  })
  for (const d of data.debts) {
    const [u, id, debtType, direction, currency, linkedPm, isGold, installmentAmount, provider, providerName, status, cleared, remaining, amount, name] = d as [string, string, string, string, string, string | null, boolean, number | null, string | null, string | null, string, boolean, number | null, number | null, string]
    if (!users.has(u)) continue
    store.tables.debts.push({
      id, user_id: u, debt_type: debtType, direction, currency, linked_payment_method_id: linkedPm, is_gold: isGold, installment_amount: installmentAmount,
      installment_provider: provider, installment_provider_name: providerName, status, cleared_at: cleared ? '2026-01-01T00:00:00.000Z' : null,
      remaining_amount: remaining, amount, starting_balance: null, name, deleted_at: null,
    })
  }
  for (const a of data.answers) {
    const [u, accountA, accountB, isOwn] = a as [string, string, string, boolean]
    if (users.has(u)) store.tables.sms_own_transfer_answers.push({ user_id: u, account_a: accountA, account_b: accountB, is_own: isOwn })
  }
  return store
}

/** Runs one dispatch to completion while the fake clock is driven, so the pairing pauses cost nothing. */
async function drive<T>(promise: Promise<T>, tick: (ms: number) => Promise<unknown>): Promise<T> {
  let done = false
  let value: T | undefined
  let failure: unknown
  let failed = false
  promise.then((v) => { value = v; done = true }, (e) => { failure = e; failed = true; done = true })
  while (!done) await tick(100)
  if (failed) throw failure
  return value as T
}

const sortKey = (l: LogIn) => `${l.receivedAt}|${l.createdAt}|${l.id}`

export async function replay(data: ReplayExport, opts: ReplayOptions): Promise<ReplayRun> {
  const all = readLogs(data)
  const wanted = new Set(opts.users ?? all.map((l) => l.user))
  const store = buildStore(data, wanted)
  const svc = makeService(store)
  const run: ReplayRun = {
    store, outcomes: new Map(), skipped: new Map(), refused: new Map(), possibleDuplicate: new Map(), refundRule: new Map(),
    templateOverrides: [], dispatched: 0, total: 0,
  }

  const byUser = new Map<string, LogIn[]>()
  for (const l of all) {
    if (!wanted.has(l.user)) continue
    run.total += 1
    byUser.set(l.user, [...(byUser.get(l.user) ?? []), l])
  }

  for (const [user, rows] of [...byUser.entries()].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))) {
    const ordered = rows.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    if (opts.swap) {
      const [x, y] = opts.swap.map((id) => ordered.findIndex((l) => l.id === id))
      if (x >= 0 && y >= 0) [ordered[x], ordered[y]] = [ordered[y], ordered[x]]
    }
    for (const l of ordered) await replayOne(run, svc, user, l, opts)
  }
  return run
}

async function replayOne(run: ReplayRun, svc: ServiceClient, user: string, l: LogIn, opts: ReplayOptions): Promise<void> {
  const logs = run.store.tables.sms_parse_log
  if (l.status === 'rejected') return void run.skipped.set(l.id, 'not_a_transaction')
  if (l.status === 'failed') return void run.skipped.set(l.id, 'failed_before_parse')
  if (l.amount == null || !l.kind || !l.body || !l.currency) return void run.skipped.set(l.id, 'no_kind_or_amount')

  // The duplicate guard lives in the route, so it is applied here with the same pure functions, before dispatch.
  const bodyHash = computeBodyHash(l.body)
  const capturedAt = captureSecond(l.receivedAt)
  const sameCapture = logs.find((r) => r.user_id === user && r.body_hash === bodyHash && r.captured_at === capturedAt && !r.is_duplicate && capturedAt !== null)
  let verdict: 'proven_duplicate' | 'possible_duplicate' | null = null
  let copyOf: string | null = null
  if (!sameCapture) {
    const candidates = logs
      .filter((r) => r.user_id === user && r.body_hash === bodyHash && !r.is_duplicate && r.status !== 'failed' && r.status !== 'rejected')
      .filter((r) => Math.abs(Date.parse(r.received_at as string) - Date.parse(l.receivedAt)) <= SECOND_COPY_WINDOW_MS)
    const copies = standingCopies({ id: l.id, received_at: l.receivedAt, captured_at: capturedAt }, candidates.map((r) => ({
      id: r.id as string, status: r.status as string | null, received_at: r.received_at as string, captured_at: r.captured_at as string | null,
      expense_id: (r.expense_id as string | null) ?? null, income_id: (r.income_id as string | null) ?? null,
    } satisfies CopyRow)))
    if (copies.length) {
      // Only the payment reference half is evaluated: a running balance is a number and the masked text has none.
      verdict = secondCopyVerdict({ hasReference: extractIpnReference(l.body) != null, hasBalance: false })
      copyOf = copies[0].id
    }
  }
  if (sameCapture || verdict === 'proven_duplicate') {
    run.refused.set(l.id, { of: (sameCapture?.id ?? copyOf) as string, rule: sameCapture ? 'same_capture' : 'proven_copy' })
    return
  }
  if (l.isDuplicate) return void run.skipped.set(l.id, 'live_duplicate_not_caught_by_guard')
  if (verdict === 'possible_duplicate') run.possibleDuplicate.set(l.id, copyOf as string)

  logs.push({
    id: l.id, user_id: user, source: 'sms', sender: l.sender, raw_body: l.body, parsed_ok: false, status: 'processing', body_hash: bodyHash, captured_at: capturedAt,
    received_at: l.receivedAt, device_id: l.device, is_duplicate: false, awaiting_confirmation: false, paired_log_id: null, expense_id: null, income_id: null,
    debt_payment_id: null, kind: null, amount: null,
  })

  const modelAsserted = l.parseMethod !== 'fully_curated'
  const kindSource: 'code' | 'model' = l.kind === 'own_transfer' && opts.ownTransfer === 'stored' ? 'code' : modelAsserted ? 'model' : 'code'
  const flags: SmsFlag[] = verdict === 'possible_duplicate' ? ['possible_duplicate'] : []
  const row: SmsRowData = {
    userId: user, amount: l.amount, currency: l.currency, day: smsLocalDay(l.receivedAt), kind: l.kind as SmsRowData['kind'], cleanTitle: l.cleanTitle,
    merchantNormalized: l.merchantNormalized, merchant: l.merchant, bankName: l.bankName, categoryHint: l.category, source: 'sms', rawBody: opts.digits === 'zeros' ? l.body.replace(/#{4,}/g, '0000').replace(/#/g, '0') : l.body, sender: l.sender,
    last4: l.accountLast4, counterpartyLast4: l.counterpartyLast4, receivedAtIso: l.receivedAt, logId: l.id, matchedTemplateId: l.matchedTemplate,
    counterpartyIsSelf: l.counterpartyIsSelf, deviceId: l.device, counterpartyHash: l.counterpartyHash, referenceHash: l.referenceHash, kindSource,
    smsFlags: flags.length ? flags : undefined,
  }

  // What rule a refund will match by is only visible by reading it first; the read changes nothing.
  if (l.kind === 'refund' && !isDeclineMessage(l.kind, l.body)) {
    const pick = await drive(findRefundOriginal(svc, row), opts.tick)
    run.refundRule.set(l.id, pick?.rule ?? null)
  }

  const bumpsBefore = run.store.rpcLog.filter((r) => r.fn === 'bump_sms_template_failure').length
  let confirmedPass = false
  let tx = await drive(createSmsTransaction(svc, row, { exchangeRates: {} }), opts.tick).catch((e: unknown) => {
    throw new Error(`closingReplay: dispatch of ${l.id} failed: ${e instanceof Error ? e.message : String(e)}`)
  })
  // A row the user answered ("tapped" in the stored status) is dispatched again as confirmed, as /confirm does.
  if (tx.outcome === 'awaiting_confirmation' && l.status === 'tapped') {
    confirmedPass = true
    tx = await drive(createSmsTransaction(svc, row, { exchangeRates: {}, userConfirmed: true }), opts.tick)
  }
  if (run.store.rpcLog.filter((r) => r.fn === 'bump_sms_template_failure').length > bumpsBefore) run.templateOverrides.push(l.id)

  // What the route writes back after dispatch (the APPLIED kind is load-bearing: pairing matches on it).
  const posted = !!(tx.expenseId || tx.incomeId || tx.debtPaymentId)
  const intentionalNoPost = tx.outcome === 'transfer_paired' && !tx.expenseId
  const salaryAwaiting = tx.outcome === 'income_matched'
  const debtAwaiting = tx.outcome === 'awaiting_confirmation'
  const addFailed = !!tx.error || (!posted && !intentionalNoPost && !salaryAwaiting && !debtAwaiting)
  Object.assign(logs.find((r) => r.id === l.id) as Row, {
    parsed_ok: true,
    status: addFailed ? 'add_failed' : tx.outcome === 'transfer_paired' ? 'paired' : posted && !debtAwaiting ? 'confirmed' : 'logged',
    awaiting_confirmation: addFailed || salaryAwaiting || debtAwaiting,
    amount: l.amount, currency: l.currency, account_last4: l.accountLast4, counterparty_last4: l.counterpartyLast4,
    category: tx.category ?? l.category, kind: tx.kind ?? l.kind, clean_title: l.cleanTitle, merchant_normalized: l.merchantNormalized, bank_name: l.bankName,
    expense_id: tx.expenseId, income_id: tx.incomeId, debt_payment_id: tx.debtPaymentId,
  })
  run.dispatched += 1
  run.outcomes.set(l.id, {
    outcome: tx.outcome, kind: tx.kind ?? null, expenseId: tx.expenseId, incomeId: tx.incomeId, debtPaymentId: tx.debtPaymentId, kindSource, confirmedPass,
    error: tx.error ? tx.error.message : null,
  })
}

// ---------------------------------------------------------------------------------------------------------------
// Reading a run
// ---------------------------------------------------------------------------------------------------------------

/** How a message's own money counts: spending, a non-spend movement, a net-zero stamped row, income, or nothing. */
export type OutcomeClass = 'spend' | 'nonspend' | 'netzero' | 'income' | 'none' | 'booked_then_none'

const NON_SPEND = new Set(['Transfer', 'CC Payoff', 'ATM Cash Withdrawal', 'Installment', 'Currency Exchange'])

const classOfExpense = (category: string | null, refunded: boolean): OutcomeClass =>
  refunded ? 'netzero' : category && NON_SPEND.has(category) ? 'nonspend' : 'spend'

export const ownExpenses = (run: ReplayRun, id: string): Row[] =>
  run.store.tables.expenses.filter((e) => e.sms_log_id === id && e.description !== 'Transfer fee')
export const ownIncomes = (run: ReplayRun, id: string): Row[] => run.store.tables.income_events.filter((e) => e.sms_log_id === id)
export const logOf = (run: ReplayRun, id: string): Row | undefined => run.store.tables.sms_parse_log.find((l) => l.id === id)

export function replayClass(run: ReplayRun, id: string): OutcomeClass {
  const e = ownExpenses(run, id).find((r) => r.deleted_at == null)
  if (e) return classOfExpense(e.category as string | null, e.refunded_at != null)
  return ownIncomes(run, id).some((r) => r.deleted_at == null) ? 'income' : 'none'
}

/**
 * How the live data counts a message's money now. A message that stored a money id but owns no live row is
 * 'booked_then_none': its row was deleted since, or the id points at another message's row (an acknowledged repeat).
 * Live categories carry the user's own edits, which the data cannot tell apart from what the server did.
 */
export function liveClass(data: ReplayExport, id: string, storedMoneyId = false): OutcomeClass {
  const e = data.liveExp.find((r) => r[0] === id)
  if (e) return classOfExpense(e[1] as string | null, e[2] != null)
  if (data.liveInc.some((r) => r[0] === id)) return 'income'
  return storedMoneyId ? 'booked_then_none' : 'none'
}

/** Every pair of logs paired in the run, as sorted id pairs. */
export function pairsOf(run: ReplayRun): Set<string> {
  const out = new Set<string>()
  for (const l of run.store.tables.sms_parse_log) if (l.paired_log_id) out.add([l.id as string, l.paired_log_id as string].sort().join('+'))
  return out
}

export function livePairs(logs: readonly LogIn[]): Set<string> {
  const out = new Set<string>()
  for (const l of logs) if (l.paired) out.add([l.id, l.paired].sort().join('+'))
  return out
}
