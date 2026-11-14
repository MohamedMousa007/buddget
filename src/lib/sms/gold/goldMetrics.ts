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
import { isGenericMerchant, resolveKnownMerchant } from '@/lib/sms/merchantDictionary'
import { catalogCategory, uniquePrefixCategory } from '@/lib/sms/merchantCategoryCache'
import { findPassThroughLegs } from '@/lib/sms/passThrough'
import { brandSpellings } from '@/lib/sms/pairing'
import { fxLegAction } from '@/lib/sms/fxEvent'
import { coarseShapeKey } from '@/lib/sms/skeleton'
import { effectiveSender } from '@/lib/sms/routingKey'
import { MIN_AI_REJECTIONS } from '@/lib/sms/negativeCache'
import { MIN_FORMAT_USERS, MIN_HISTORY_DIGITS, bodyNameIsTheSender } from '@/lib/sms/providerCascade'
import { PAYMENT_BRANDS, normalizeBrandToken } from '@/lib/payment/paymentMethodDefaults'

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
  /** Raw text by log id for the recent rows that still have it, local only. Bank names survive in it; masking can remove them. */
  raw?: Record<string, string>
}

/**
 * The bank of every parsed row as the provider cascade names it (providerCascade.ts): sender, code pattern, the body,
 * this user's history of the digits, then other users' format. A stored bank name with no sender and no code pattern
 * behind it was the AI's guess and names nothing.
 */
export function replayBanks(inputs: GoldInputs): { bank: Map<string, string | null>; stage: Map<string, string> } {
  const text = (r: GoldRow) => inputs.raw?.[r.id] ?? inputs.bodies?.[r.id] ?? ''
  const all = inputs.rows.filter((r) => r.k && !r.dup)
  const trusted = (r: GoldRow) => resolvePaymentBrandKey(r.s) ?? (r.pid ? resolvePaymentBrandKey(r.b) : null)
  const inBody = (r: GoldRow) => {
    const found = providerFromBody(text(r))
    return found && bodyNameIsTheSender(found, r.k) ? found.brandId : null
  }
  const evidence = new Map(all.map((r) => [r.id, trusted(r) ?? inBody(r)]))
  const byTail = new Map<string, Set<string>>()
  const byFormat = new Map<string, Map<string, Set<string>>>()
  const formatOf = new Map(all.map((r) => [r.id, inputs.bodies ? coarseShapeKey(text(r), null) : null]))
  for (const r of all) {
    const bank = evidence.get(r.id)
    if (!bank) continue
    if (r.t && r.t.length >= MIN_HISTORY_DIGITS) byTail.set(`${r.u}|${r.t}`, (byTail.get(`${r.u}|${r.t}`) ?? new Set()).add(bank))
    const key = formatOf.get(r.id)
    if (key) {
      const banks = byFormat.get(key) ?? new Map<string, Set<string>>()
      banks.set(bank, (banks.get(bank) ?? new Set()).add(r.u))
      byFormat.set(key, banks)
    }
  }
  const bank = new Map<string, string | null>()
  const stage = new Map<string, string>()
  for (const r of all) {
    const direct = evidence.get(r.id)
    if (direct) { bank.set(r.id, direct); stage.set(r.id, trusted(r) ? 'sender or pattern' : 'body'); continue }
    const history = r.t ? byTail.get(`${r.u}|${r.t}`) : undefined
    if (history?.size === 1) { bank.set(r.id, [...history][0]); stage.set(r.id, 'history'); continue }
    const votes = [...(byFormat.get(formatOf.get(r.id) ?? '') ?? new Map<string, Set<string>>())].map(([b, users]) => [b, [...users].filter((u) => u !== r.u).length] as const).filter(([, n]) => n > 0)
    if (votes.length === 1 && votes[0][1] >= MIN_FORMAT_USERS) { bank.set(r.id, votes[0][0]); stage.set(r.id, 'format'); continue }
    bank.set(r.id, null)
  }
  return { bank, stage }
}

export interface Metric { name: string; now: string; replay: string; target: string }

const PURCHASE = new Set(['purchase', 'online_purchase'])
const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${Math.round((n / d) * 100)}% (${n}/${d})`)
const foldName = (m: string | undefined) => (m ? m.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '') || null : null)

/**
 * Replays account placement in arrival order, so an account one message creates receives the next ones, as on the
 * server. Returns, per log id, where the row lands: a registered account, a provisional one, or nowhere.
 */
export function replayPlacement(inputs: GoldInputs): Map<string, 'existing' | 'provisional' | 'unassigned'> {
  return replayAccounts(inputs).placement
}

/** Placement plus, per user, the stored-value brands (wallets, prepaid) they hold: registered ones and provisional ones with the instant they appear. */
export function replayAccounts(inputs: GoldInputs): { placement: Map<string, 'existing' | 'provisional' | 'unassigned'>; wallets: Map<string, Map<string, number>> } {
  const wallets = new Map<string, Map<string, number>>()
  const addWallet = (u: string, brand: string | null, since: number) => {
    if (!brand || PAYMENT_BRANDS[brand]?.type !== 'wallet' || PAYMENT_BRANDS[brand].passThrough) return
    const mine = wallets.get(u) ?? new Map<string, number>()
    if (!mine.has(brand)) mine.set(brand, since)
    wallets.set(u, mine)
  }
  for (const m of inputs.methods) {
    if (m.type === 'wallet' || m.type === 'prepaid_card') addWallet(m.u, resolvePaymentBrandKey(decomposePaymentMethodName(m.name.trim(), m.t ?? undefined).provider), 0)
  }
  const byUser = new Map<string, Identified[]>()
  for (const m of inputs.methods) {
    const bankKey = resolvePaymentBrandKey(decomposePaymentMethodName(m.name.trim(), m.t ?? undefined).provider) ?? resolvePaymentBrandKey(m.name)
    byUser.set(m.u, [...(byUser.get(m.u) ?? []), { id: m.id, last4: m.t, last4Aliases: m.al, bankKey }])
  }
  const banks = replayBanks(inputs).bank
  const created = new Set<string>()
  const out = new Map<string, 'existing' | 'provisional' | 'unassigned'>()
  for (const r of [...inputs.rows].sort((a, b) => a.ts - b.ts)) {
    if (!r.k || r.dup) continue
    const methods = byUser.get(r.u) ?? []
    const p = placeSmsAccount(methods, { tail: r.t ?? null, bankKey: banks.get(r.id) ?? null, currency: r.c ?? null })
    if (p.kind === 'provisional') {
      const id = `prov:${r.u}:${p.bankKey}:${p.tail}:${p.currency}`
      created.add(id)
      byUser.set(r.u, [...methods, { id, last4: p.tail, bankKey: p.bankKey }])
      if (p.bankKey) addWallet(r.u, p.bankKey, r.ts)
      out.set(r.id, 'provisional')
    } else if (p.kind === 'existing') out.set(r.id, created.has(p.id) ? 'provisional' : 'existing')
    else out.set(r.id, 'unassigned')
  }
  return { placement: out, wallets }
}

export function computeGoldMetrics(inputs: GoldInputs, labels: Record<string, GoldLabel>, split: 't' | 'h'): Metric[] {
  const rows = inputs.rows.filter((r) => labels[r.id]?.s === split && !r.dup)
  const out: Metric[] = []

  // 1 + 2. Accounts.
  const expenseRows = rows.filter((r) => r.e && r.ecat !== 'CC Payoff')
  const unplacedNow = expenseRows.filter((r) => !r.epm)
  // A row production already placed keeps its account; the rest go through today's placement.
  const { placement, wallets } = replayAccounts(inputs)
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
  const namedBanks = replayBanks(inputs).bank
  const noBank = stillUnplaced.filter((r) => !namedBanks.get(r.id)).length
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
  // Replay of resolveMerchantCategory in arrival order: dictionary and catalog first, then what this user's earlier
  // purchases at the same (normalized) merchant were filed under, then the category production stored.
  const memory = new Map<string, string>()
  const replayCat = new Map<string, string | null>()
  const titleOf = (r: GoldRow) => normalizeMerchant(r.m, r.k as 'purchase') ?? ''
  for (const r of [...inputs.rows].sort((x, y) => x.ts - y.ts)) {
    if (!PURCHASE.has(r.k ?? '') || !r.m || !r.e) continue
    const title = titleOf(r)
    const mem = `${r.u}|${title.toLowerCase()}`
    const stored = r.ecat && r.ecat !== 'Other' ? r.ecat : null
    const generic = isGenericMerchant(title)
    // The user's own earlier spellings of a cut-off name: exactly one earlier merchant with 5+ characters shared.
    const earlier = [...memory].filter(([k]) => k.startsWith(`${r.u}|`)).map(([k, category]) => ({ description: k.slice(r.u.length + 1), category }))
    const cat = generic ? stored : resolveKnownMerchant(title)?.category ?? catalogCategory(title) ?? memory.get(mem) ?? uniquePrefixCategory(title, earlier) ?? stored
    if (cat && !generic && !memory.has(mem)) memory.set(mem, cat)
    replayCat.set(r.id, cat)
  }
  // The background categoriser back-fills this user's earlier 'Other' rows at a merchant once it learns the category.
  for (const r of booked) if (!replayCat.get(r.id)) replayCat.set(r.id, memory.get(`${r.u}|${titleOf(r).toLowerCase()}`) ?? null)
  out.push({
    name: 'Purchases in Other or uncategorised',
    now: pct(booked.filter((r) => !r.ecat || r.ecat === 'Other').length, booked.length),
    replay: pct(booked.filter((r) => !replayCat.get(r.id)).length, booked.length),
    target: '<25%',
  })
  const consistent = (keyOf: (r: GoldRow) => string | null, catOf: (r: GoldRow) => string) => {
    const groups = new Map<string, Set<string>>()
    for (const r of booked) {
      const k = keyOf(r)
      if (k) groups.set(`${r.u}|${k}`, (groups.get(`${r.u}|${k}`) ?? new Set()).add(catOf(r)))
    }
    return pct([...groups.values()].filter((g) => g.size === 1).length, groups.size)
  }
  out.push({
    name: 'Same merchant, same category (per user)',
    now: consistent((r) => foldName(r.m), (r) => r.ecat ?? 'Other'),
    // A bare company-form word is not one merchant, so it is not held to one category.
    replay: consistent((r) => (isGenericMerchant(titleOf(r)) ? null : titleOf(r).toLowerCase() || null), (r) => replayCat.get(r.id) ?? 'Other'),
    target: '100%',
  })
  out.push({ name: '  distinct merchants per user (fewer = variants merged)', now: String(new Set(booked.map((r) => `${r.u}|${foldName(r.m)}`)).size), replay: String(new Set(booked.map((r) => `${r.u}|${titleOf(r).toLowerCase()}`)).size), target: '-' })

  // 6. Wallet top-ups: either leg booked as spend or as income. Replay of dispatch step 0: the funding leg is a
  // purchase whose merchant IS a wallet the user holds at that moment, which makes both legs one own transfer.
  const byId = new Map(inputs.rows.map((r) => [r.id, r]))
  const topups = rows.filter((r) => labels[r.id].topup)
  const resolvesAsTransfer = (r: GoldRow) => {
    const partner = byId.get(labels[r.id].topup ?? '')
    const funding = PURCHASE.has(r.k ?? '') || r.k === 'own_transfer' ? r : partner
    const brand = funding?.m ? Object.keys(PAYMENT_BRANDS).find((id) => brandSpellings(id).includes(normalizeBrandToken(funding.m as string))) : undefined
    const since = brand ? wallets.get(r.u)?.get(brand) : undefined
    return since !== undefined && since <= (funding?.ts ?? 0)
  }
  out.push({
    name: 'Wallet top-up legs counted as income or expense',
    now: pct(topups.filter((r) => (r.e && r.ecat !== 'Transfer') || r.i).length, topups.length),
    replay: pct(topups.filter((r) => !resolvesAsTransfer(r)).length, topups.length),
    target: '0',
  })

  // 7. Relay (pass-through) legs: a credit and an outgoing transfer of one amount on one account, minutes apart.
  const relays = rows.filter((r) => labels[r.id].relay)
  const flagged = findPassThroughLegs(inputs.rows.filter((r) => r.k && !r.dup && r.a).map((r) => ({
    id: r.id, owner: r.u, dir: r.k === 'instant_transfer_out' ? 'out' as const : 'in' as const, amount: r.a as number, currency: r.c ?? '', account: r.t ?? null, at: r.ts * 1000,
  })).filter((l, i, all) => l.dir === 'out' || ['instant_transfer_in', 'income'].includes(byId.get(all[i].id)?.k ?? '')))
  out.push({ name: 'Relay legs flagged "possible pass-through"', now: pct(0, relays.length), replay: pct(relays.filter((r) => flagged.has(r.id)).length, relays.length), target: '>=90%' })

  // 8. FX: an expense on the credit leg, or a booked leg that never credits the destination. Replay of fxLegAction:
  // the credited account must take the destination role and the debited one the source role, whichever arrives
  // first. A leg whose direction the message does not state cannot be placed and is counted as wrong.
  const fx = rows.filter((r) => labels[r.id].fx)
  const fxWrongReplay = fx.filter((r) => {
    const direction = labels[r.id].fx
    if (direction !== 'debit' && direction !== 'credit') return true
    const want = direction === 'credit' ? 'destination' : 'source'
    const first = fxLegAction(direction, false)
    const second = fxLegAction(direction, true)
    return (first.type === 'post' ? first.role : null) !== want || (second.type === 'complete' ? second.set : null) !== want
  })
  out.push({
    name: 'FX legs booked wrongly',
    now: pct(fx.filter((r) => r.e && (r.ld === 'credit' || !r.eto)).length, fx.length),
    replay: pct(fxWrongReplay.length, fx.length),
    target: '0',
  })

  // 9 + 10. Speed. These need wording, so they run only when the local masked bodies are present.
  const parsed = rows.filter((r) => r.k)
  const aiNow = pct(parsed.filter((r) => r.pm === 'ai_new').length, parsed.length)
  if (!inputs.bodies) {
    out.push({ name: 'Parsed messages needing the AI', now: aiNow, replay: 'needs the local masked bodies', target: '<35%' })
    return out
  }
  const bodies = inputs.bodies
  const ordered = [...inputs.rows].filter((r) => !r.dup && bodies[r.id]).sort((x, y) => x.ts - y.ts)
  const coarse = (r: GoldRow) => coarseShapeKey(bodies[r.id], effectiveSender(r.s ?? null, bodies[r.id], null))
  // A message is "seen before" when an earlier message of the same coarse shape parsed as a transaction: with a
  // template learned from that first sight it would not need the AI. This is the floor templates can reach.
  const parsedShapes = new Set<string>()
  const firstSight = new Set<string>()
  // Negative cache replay: the exact masked body was rejected by the AI at least twice before and never parsed.
  const aiRejections = new Map<string, number>()
  const parsedBodies = new Set<string>()
  const cached = new Set<string>()
  for (const r of ordered) {
    const body = bodies[r.id]
    const shape = coarse(r)
    if (r.k) {
      if (r.pm === 'ai_new' && !(shape && parsedShapes.has(shape))) firstSight.add(r.id)
      if (shape) parsedShapes.add(shape)
      parsedBodies.add(body)
    } else if (r.st === 'rejected' && r.pm === 'ai_new') {
      if ((aiRejections.get(body) ?? 0) >= MIN_AI_REJECTIONS && !parsedBodies.has(body)) cached.add(r.id)
      else aiRejections.set(body, (aiRejections.get(body) ?? 0) + 1)
    }
  }
  out.push({
    name: 'Parsed messages needing the AI',
    now: aiNow,
    replay: `${pct(parsed.filter((r) => firstSight.has(r.id)).length, parsed.length)} floor, if every shape seen once had a template`,
    target: '<35%',
  })
  const aiRejected = rows.filter((r) => !r.k && r.st === 'rejected' && r.pm === 'ai_new')
  const repeats = aiRejected.filter((r) => cached.has(r.id)).length
  out.push({ name: 'Repeat rejected shapes sent to the AI', now: `${repeats} of ${aiRejected.length} AI rejections`, replay: `0 (${repeats} answered from the negative cache)`, target: '0' })
  const inSplit = rows.filter((r) => bodies[r.id])
  out.push({ name: '  distinct shapes: fine skeleton vs coarse key', now: String(new Set(inSplit.map((r) => r.sk)).size), replay: String(new Set(inSplit.map((r) => coarse(r))).size), target: '-' })
  return out
}

/**
 * Part 1 of the follow-up: how well each stage of the provider cascade names the bank. Measured on rows whose bank
 * is KNOWN (the sender, or a code-shipped pattern, named it) with that knowledge hidden, so every stage has a truth
 * to be scored against. A stage may act on its own only at 99% precision or better.
 */
export function providerStageMetrics(inputs: GoldInputs, labels: Record<string, GoldLabel>, split: 't' | 'h'): Metric[] {
  if (!inputs.bodies) return []
  const text = (r: GoldRow) => inputs.raw?.[r.id] ?? inputs.bodies?.[r.id] ?? ''
  const truthOf = (r: GoldRow) => resolvePaymentBrandKey(r.s) ?? (r.pid ? resolvePaymentBrandKey(r.b) : null)
  const bodyOf = (r: GoldRow) => {
    const found = providerFromBody(text(r))
    return found && bodyNameIsTheSender(found, r.k) ? found.brandId : null
  }
  const all = inputs.rows.filter((r) => r.k && !r.dup)
  // What another row may vouch for: its sender or pattern, or a bank its own text prints.
  const evidence = new Map(all.map((r) => [r.id, truthOf(r) ?? bodyOf(r)]))
  // Computed once per row: the key hashes the masked text, and the stages below compare every row with every other.
  const formatKeys = new Map(all.map((r) => [r.id, coarseShapeKey(text(r), null)]))
  const formatOf = (r: GoldRow) => formatKeys.get(r.id) ?? null
  const history = (r: GoldRow) => {
    if (!r.t || r.t.length < MIN_HISTORY_DIGITS) return null
    const banks = new Set(all.filter((x) => x.id !== r.id && x.u === r.u && x.t === r.t).map((x) => evidence.get(x.id)).filter(Boolean))
    return banks.size === 1 ? ([...banks][0] as string) : null
  }
  const format = (r: GoldRow, minUsers: number) => {
    const key = formatOf(r)
    if (!key) return null
    const users = new Map<string, Set<string>>()
    for (const x of all) {
      const bank = x.u !== r.u && formatOf(x) === key ? evidence.get(x.id) : null
      if (bank) users.set(bank, (users.get(bank) ?? new Set()).add(x.u))
    }
    return users.size === 1 && [...users.values()][0].size >= minUsers ? [...users.keys()][0] : null
  }
  const scored = all.filter((r) => labels[r.id]?.s === split && truthOf(r))
  const score = (name: string, predict: (r: GoldRow) => string | null): Metric => {
    const said = scored.map((r) => [predict(r), truthOf(r)] as const).filter(([p]) => p)
    return { name, now: '-', replay: `precision ${pct(said.filter(([p, t]) => p === t).length, said.length)}, coverage ${pct(said.length, scored.length)}`, target: 'precision >=99%' }
  }
  const senderless = all.filter((r) => labels[r.id]?.s === split && !truthOf(r))
  const cascade = (r: GoldRow) => bodyOf(r) ?? history(r) ?? format(r, MIN_FORMAT_USERS)
  return [
    score('Bank from the body (name or hotline), sender hidden', bodyOf),
    score('Bank from the same user\'s digits history, sender hidden', history),
    score(`Bank from other users' format (${MIN_FORMAT_USERS}+ users), sender hidden`, (r) => format(r, MIN_FORMAT_USERS)),
    score('  the same with 1+ user (what it would only suggest)', (r) => format(r, 1)),
    { name: 'Sender-less messages given a bank by the cascade', now: pct(senderless.filter((r) => resolvePaymentBrandKey(r.b)).length, senderless.length), replay: `${pct(senderless.filter((r) => cascade(r)).length, senderless.length)} (body ${senderless.filter((r) => bodyOf(r)).length}, history ${senderless.filter((r) => !bodyOf(r) && history(r)).length}, format ${senderless.filter((r) => !bodyOf(r) && !history(r) && format(r, MIN_FORMAT_USERS)).length})`, target: '-' },
  ]
}

export function formatMetrics(title: string, metrics: Metric[]): string {
  const w = Math.max(...metrics.map((m) => m.name.length))
  return [`== ${title}`, ...metrics.map((m) => `${m.name.padEnd(w)} | now ${m.now} | replay ${m.replay} | target ${m.target}`)].join('\n')
}
