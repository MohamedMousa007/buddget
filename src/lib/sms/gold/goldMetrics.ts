/**
 * Gold-set metrics (docs/launch/S1-sms-audit.md section 5).
 *
 * Two files feed it. `goldSet.json` (in git) holds LABELS ONLY, keyed by sms_parse_log id: the split (train/holdout)
 * and the rule-derived expectations. The replay inputs (structured columns of each log row and the users' accounts)
 * are exported from the live DB with `scripts/qa/sms-gold-inputs.sql` and kept OUT of git, because the merchant column
 * can carry a person's name. No message text is in either file.
 *
 * "now" is what production stored. "replay" runs today's pure decision code over the same structured inputs, so a
 * slice shows up as movement here before any live row is repaired (repair is S3).
 */
import { normalizeMerchant } from '@/lib/sms/merchantNormalizer'
import { placeSmsAccount } from '@/lib/sms/accountPlacement'
import { smsAccountLabelKind } from '@/lib/accounts/unplacedSms'
import { decomposePaymentMethodName, resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import type { Identified } from '@/lib/accounts/identity/accountRef'
import { providerFromBody } from '@/lib/sms/providerFromBody'

export interface GoldLabel { s: 't' | 'h'; topup?: string; relay?: string; fx?: string }
export interface GoldRow {
  id: string; u: string; k?: string; st: string; pm?: string; a?: number; c?: string; t?: string; ct?: string
  b?: string; s?: string; ts: number; m?: string; mh?: string; mn?: 1; cat?: string; pid?: string; sk: string
  ld?: string; pl?: string; dup?: 1; e?: 1; epm?: string; eto?: string; ecat?: string; i?: 1; ipm?: string
}
export interface GoldMethod { id: string; u: string; type: string; c: string; t: string | null; al: string[] | null; name: string; closed: boolean }
export interface GoldInputs {
  rows: GoldRow[]
  methods: GoldMethod[]
  /** Masked bodies by log id, local only. Old rows stored no bank name; today's route names it from the body. */
  bodies?: Record<string, string>
}

/** The bank a message is from, resolved the way the parse route does: sender, stored bank name, then the body. */
export function bankKeyOf(inputs: GoldInputs, r: GoldRow): string | null {
  return resolvePaymentBrandKey(r.s) ?? resolvePaymentBrandKey(r.b)
    ?? resolvePaymentBrandKey(inputs.bodies?.[r.id] ? providerFromBody(inputs.bodies[r.id])?.name : null)
}

export interface Metric { name: string; now: string; replay: string; target: string }

const PURCHASE = new Set(['purchase', 'online_purchase'])
const PENDING = 'pending (later slice)'
const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${Math.round((n / d) * 100)}% (${n}/${d})`)
const foldName = (m: string | undefined) => (m ? m.toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '') || null : null)

/**
 * Replays account placement in arrival order, so an account one message creates receives the next ones, as on the
 * server. Returns, per log id, where the row lands: a registered account, a provisional one, or nowhere.
 */
export function replayPlacement(inputs: GoldInputs): Map<string, 'existing' | 'provisional' | 'unassigned'> {
  const byUser = new Map<string, Identified[]>()
  for (const m of inputs.methods) {
    const bankKey = resolvePaymentBrandKey(decomposePaymentMethodName(m.name.trim(), m.t ?? undefined).provider) ?? resolvePaymentBrandKey(m.name)
    byUser.set(m.u, [...(byUser.get(m.u) ?? []), { id: m.id, last4: m.t, last4Aliases: m.al, bankKey }])
  }
  const created = new Set<string>()
  const out = new Map<string, 'existing' | 'provisional' | 'unassigned'>()
  for (const r of [...inputs.rows].sort((a, b) => a.ts - b.ts)) {
    if (!r.k || r.dup) continue
    const methods = byUser.get(r.u) ?? []
    const p = placeSmsAccount(methods, { tail: r.t ?? null, bankKey: bankKeyOf(inputs, r), currency: r.c ?? null })
    if (p.kind === 'provisional') {
      const id = `prov:${r.u}:${p.bankKey}:${p.tail}:${p.currency}`
      created.add(id)
      byUser.set(r.u, [...methods, { id, last4: p.tail, bankKey: p.bankKey }])
      out.set(r.id, 'provisional')
    } else if (p.kind === 'existing') out.set(r.id, created.has(p.id) ? 'provisional' : 'existing')
    else out.set(r.id, 'unassigned')
  }
  return out
}

export function computeGoldMetrics(inputs: GoldInputs, labels: Record<string, GoldLabel>, split: 't' | 'h'): Metric[] {
  const rows = inputs.rows.filter((r) => labels[r.id]?.s === split && !r.dup)
  const out: Metric[] = []

  // 1 + 2. Accounts.
  const expenseRows = rows.filter((r) => r.e && r.ecat !== 'CC Payoff')
  const unplacedNow = expenseRows.filter((r) => !r.epm)
  // A row production already placed keeps its account; the rest go through today's placement.
  const placement = replayPlacement(inputs)
  const landsOn = (r: GoldRow) => (r.epm ? 'existing' : placement.get(r.id) ?? 'unassigned')
  const stillUnplaced = expenseRows.filter((r) => landsOn(r) === 'unassigned')
  const shownAsCash = stillUnplaced.filter((r) => smsAccountLabelKind({ smsLogId: r.id, paymentMethodId: '' }) !== 'unassigned')
  out.push({ name: 'SMS expenses shown as Cash without being cash', now: String(unplacedNow.length), replay: String(shownAsCash.length), target: '0' })
  const withAccounts = new Set(inputs.methods.map((m) => m.u))
  const scoped = expenseRows.filter((r) => withAccounts.has(r.u))
  out.push({
    name: 'Unplaced SMS expenses (users with an account)',
    now: pct(scoped.filter((r) => !r.epm).length, scoped.length),
    replay: `${pct(scoped.filter((r) => landsOn(r) === 'unassigned').length, scoped.length)}, ${scoped.filter((r) => landsOn(r) === 'provisional').length} on provisional accounts`,
    target: '<10%',
  })
  out.push({
    name: 'Unplaced SMS expenses (all users)',
    now: pct(unplacedNow.length, expenseRows.length),
    replay: `${pct(stillUnplaced.length, expenseRows.length)}, ${expenseRows.filter((r) => landsOn(r) === 'provisional').length} on provisional accounts`,
    target: '<10%',
  })
  // Why the rest stay unassigned under rule 6a.1: which of bank / digits the message lacks.
  const noBank = stillUnplaced.filter((r) => !bankKeyOf(inputs, r)).length
  const noDigits = stillUnplaced.filter((r) => !r.t).length
  out.push({ name: '  of those still unassigned: no bank / no digits', now: '-', replay: `${noBank} / ${noDigits} of ${stillUnplaced.length}`, target: '-' })

  // 3 to 5. Merchant and category.
  const purchases = rows.filter((r) => PURCHASE.has(r.k ?? '') && r.m)
  out.push({
    name: 'Purchases with a normalized merchant',
    now: pct(purchases.filter((r) => r.mn).length, purchases.length),
    replay: pct(purchases.filter((r) => !!normalizeMerchant(r.m, r.k as 'purchase')).length, purchases.length),
    target: '>=95%',
  })
  const booked = purchases.filter((r) => r.e)
  out.push({ name: 'Purchases in Other or uncategorised', now: pct(booked.filter((r) => !r.ecat || r.ecat === 'Other').length, booked.length), replay: PENDING, target: '<25%' })
  const groups = new Map<string, Set<string>>()
  for (const r of booked) {
    const k = foldName(r.m)
    if (k) groups.set(`${r.u}|${k}`, (groups.get(`${r.u}|${k}`) ?? new Set()).add(r.ecat ?? 'Other'))
  }
  out.push({ name: 'Same merchant, same category (per user)', now: pct([...groups.values()].filter((s) => s.size === 1).length, groups.size), replay: PENDING, target: '100%' })

  // 6. Wallet top-ups: either leg booked as spend or as income.
  const topups = rows.filter((r) => labels[r.id].topup)
  out.push({ name: 'Wallet top-up legs counted as income or expense', now: pct(topups.filter((r) => (r.e && r.ecat !== 'Transfer') || r.i).length, topups.length), replay: PENDING, target: '0' })

  // 7. Relay (pass-through) legs.
  const relays = rows.filter((r) => labels[r.id].relay)
  out.push({ name: 'Relay legs flagged "possible pass-through"', now: pct(0, relays.length), replay: PENDING, target: '>=90%' })

  // 8. FX: an expense on the credit leg, or a booked leg that never credits the destination.
  const fx = rows.filter((r) => labels[r.id].fx)
  out.push({ name: 'FX legs booked wrongly', now: pct(fx.filter((r) => r.e && (r.ld === 'credit' || !r.eto)).length, fx.length), replay: PENDING, target: '0' })

  // 9. AI share of parsed messages. A replay figure needs message bodies, which are never exported.
  const parsed = rows.filter((r) => r.k)
  out.push({ name: 'Parsed messages needing the AI', now: pct(parsed.filter((r) => r.pm === 'ai_new').length, parsed.length), replay: 'needs bodies (see S2 closing note)', target: '<35%' })
  return out
}

export function formatMetrics(title: string, metrics: Metric[]): string {
  const w = Math.max(...metrics.map((m) => m.name.length))
  return [`== ${title}`, ...metrics.map((m) => `${m.name.padEnd(w)} | now ${m.now} | replay ${m.replay} | target ${m.target}`)].join('\n')
}
