/**
 * POST /api/sms/parse
 *
 * Hybrid AI/Static SMS parsing pipeline.
 *
 * Auth: Supabase JWT (mobile) or bearer token from `sms_ingest_tokens`.
 *
 * Behaviour:
 *  - Sender-keyed regex templates in `sms_tracking_templates_ai` are checked FIRST.
 *    If a template matches: parse completes in ~10ms with zero AI cost.
 *  - If no template matches: Gemini AI parses the SMS (rate-limited to 100/day).
 *    On high confidence (≥ 0.9) the route learns a new regex template asynchronously
 *    so future SMS from this sender bypass Gemini.
 *  - Confidence >= 0.6 → expense/income auto-added immediately.
 *  - Confidence < 0.6 → ignored (logged but not stored as an expense).
 */
import { aiCallsToday } from '@/lib/sms/aiUsage'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { quotaDeniedResponse, reserveAiQuota, settleAiQuota } from '@/lib/server/ai/quota'
import type { Database, Json } from '@/lib/supabase/database.types'
import { SMS_PARSER_SYSTEM_PROMPT, MASKED_ACCOUNT_CLASS } from '@/lib/sms/aiParserPrompt'
import { sendNativePush, type SendNativePushArgs } from '@/lib/server/sendNativePush'
import { smsDeviceGate } from '@/lib/sms/deviceGate'
import { recordIngestRefusal } from '@/lib/sms/ingestRefusal'
import { isRateLimited } from '@/lib/server/rateLimit'
import { resolveSmsCaller } from '@/lib/sms/resolveSmsUser'
import { monthNameInZone } from '@/lib/time/zonedMonth'
import { getUserTimeZone } from '@/lib/server/userTimeZone'
import { matchCuratedPattern } from '@/lib/sms/patterns'
import { applyMappingRules, type MappingRules } from '@/lib/sms/templateApply'
import { execBounded } from '@/lib/sms/boundedRegex'
import { isSafeRegexPattern, MAX_TEMPLATE_INPUT_CHARS } from '@/lib/sms/safeRegex'
import { runLearnGates } from '@/lib/sms/learnGates'
import { runAdjudication } from '@/lib/sms/runAdjudication'
import { recordSmsStats } from '@/lib/sms/statsOutbox'
import { checkPlausibility, checkCurrencyAgainstAccount, checkCrossTemplateContradiction } from '@/lib/sms/templateHealth'
import { getCuratedDbTemplates, TEMPLATE_COLUMNS } from '@/lib/sms/curatedDbCache'
import {
  partitionByScope,
  validateAgainstAiParse,
  behaviourallyEquivalent,
  computeShadowVerdicts,
  extractionToObjective,
  type TemplateCandidate,
} from '@/lib/sms/templateScope'
import { SMS_SENDER_HELD_PUSH_KIND } from '@/lib/sms/pushKinds'
import { MAX_SMS_BODY_CHARS, checkCreditSender, claimInProgressResponse, heldForConfirmation, computeLegacySmsHashes, computeNeighbourSmsHashes, computeSmsHash, hasPostedTransaction, isClaimInFlight, isStaleClaim, maskOtpDigits, nonTransactionReason, smsLocalDay, smsPlausibilityIssue } from '@/lib/sms/ingestGuards'
import { withSmsAiQuota } from '@/lib/sms/meteredAi'
import { normalizeSmsText } from '@/lib/sms/normalizeDigits'
import { senderCapReached } from '@/lib/sms/senderCap'
import { classifyLearnStatus, decideLearnRetry, encodeLearnStatus } from '@/lib/sms/learnRetry'
import { loadReplayCases } from '@/lib/sms/replayLoader'
import { bumpTemplateFailure } from '@/lib/sms/bumpTemplateFailure'
import { checkAndAutoPromote } from '@/lib/sms/promotionChecker'
import { lookupKeys, effectiveSender } from '@/lib/sms/routingKey'
import { fetchCorrectionExemplar } from '@/lib/sms/correctionExemplar'
import { createSmsTransaction, extractIpnReference, type SmsTxResult } from '@/lib/sms/dispatch'
import { rememberMerchantCategory } from '@/lib/sms/merchantCategoryCache'
import { normalizeMerchant } from '@/lib/sms/merchantNormalizer'
import { isGenericMerchant } from '@/lib/sms/merchantDictionary'
import { hasPersonCounterparty, isOwnName, ownNames } from '@/lib/sms/ownName'
import { KNOWN_NON_TRANSACTION, isKnownNonTransaction } from '@/lib/sms/negativeCache'
import { coarseShapeKey, maskSkeletonText } from '@/lib/sms/skeleton'
import { resolveProvider } from '@/lib/sms/providerCascade'
import { counterpartyHash, referenceHash } from '@/lib/sms/ownTransferDecision'
import { PAYMENT_BRANDS } from '@/lib/payment/paymentMethodDefaults'
import { buildMerchantCategoryPrompt, MERCHANT_CATEGORY_CHOICES } from '@/lib/sms/merchantCategoryPrompt'
import type { ExpenseCategory } from '@/lib/store/types'
import { DEFAULT_MARKET_RATES } from '@/lib/store/defaultFinanceData'
import { resolveCurrency } from '@/lib/sms/currencyResolver'
import { recordBalanceReport } from '@/lib/sms/balanceReport'
import { extractAccountTail } from '@/lib/accounts/identity/accountRef'
import { providerFromBody } from '@/lib/sms/providerFromBody'
import { getServerDictionary } from '@/lib/i18n/getServerDictionary'
import { getUserLocale } from '@/lib/server/userLocale'
import { emitNotification } from '@/lib/server/emitNotification'
import { nudgeUser } from '@/lib/server/realtime/nudge'

// Gemini takes 5–8 s and after() work (push + 15 s pattern learning) counts
// toward the function cap — the default would kill learning mid-call.
export const maxDuration = 60

const GEMINI_MODEL = 'gemini-2.5-flash'

/** Kinds whose "from <masked number>" names the account the money left; a transfer's number names the other side. */
const SOURCE_ACCOUNT_KINDS: ReadonlySet<string> = new Set(['purchase', 'online_purchase', 'atm_withdrawal', 'fee'])
/** Typical cost of one SMS parse (prompt plus a short JSON answer) in quota units. */
const SMS_PARSE_UNITS = 1500
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
/** The key travels in a header, never the URL, so request-URL logs and proxies cannot capture it. */
const geminiHeaders = (apiKey: string) => ({ 'Content-Type': 'application/json', 'x-goog-api-key': apiKey })

const RATE_LIMIT_PER_DAY = 100
const CONFIRM_CONFIDENCE = 0.6
const PATTERN_LEARN_CONFIDENCE = 0.9
// Share of parses that trigger the background adjudication pass (the zero-variance check runs on a database
// schedule). A maintenance pass, not per-message logic; it costs an AI call, so it is kept rare.
const HEALTH_SWEEP_SAMPLE_RATE = 0.02

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const bodySchema = z.object({
  message: z.string().min(1).max(MAX_SMS_BODY_CHARS * 10).transform((m) => m.slice(0, MAX_SMS_BODY_CHARS)),
  sender: z.string().max(120).nullable().optional(),
  source: z.enum(['sms', 'notification', 'manual']).optional(),
  receivedAt: z.string().datetime({ offset: true }).optional(),
  /** Per-capture id minted by the native queue: the retry identity (header `x-sms-event-id` carries the same value). */
  eventId: z.string().uuid().optional(),
  truncated: z.boolean().optional(),
})

function salvageBody(json: unknown): Record<string, unknown> {
  const o = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  const out: Record<string, unknown> = { message: o.message }
  for (const k of ['sender', 'source', 'receivedAt', 'eventId', 'truncated'] as const) {
    if (bodySchema.shape[k].safeParse(o[k]).success) out[k] = o[k]
  }
  return out
}

interface ParsedTx {
  is_transaction: boolean
  amount: number | null
  currency: string | null
  merchant: string | null
  bank_name: string | null
  category: string | null
  confidence: number
  kind: 'purchase' | 'online_purchase' | 'atm_withdrawal' | 'instant_transfer_out' |
        'instant_transfer_in' | 'cc_payoff' | 'installment_payment' | 'own_transfer' | 'currency_exchange' |
        'income' | 'refund' | 'declined' | 'fee' | 'other' | null
  cleanTitle: string | null
  detectedAccountLast4: string | null
  detectedCounterpartyLast4: string | null
  merchantNormalized: string | null
}

// ---------------------------------------------------------------------------
// JSON extractor — handles Gemini markdown fences and preamble text
// ---------------------------------------------------------------------------

/**
 * String-aware bracket extractor: skips { } inside JSON string literals and
 * handles backslash escapes. Works around Gemini occasionally wrapping output
 * in ```json fences or prepending explanation text.
 */
function extractJson(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0, inString = false, escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return text.slice(start, i + 1) }
  }
  return null
}

// ---------------------------------------------------------------------------
// Static template bypass (cache-backed)
// ---------------------------------------------------------------------------

interface TemplateMatch {
  parsed: ParsedTx
  templateId: string
  tier: TemplateTier
  /** Transaction date from the SMS body (YYYY-MM-DD), else null. */
  txDay: string | null
  paymentInstrument: string | null
}

/** Reach of a DB template: author-scoped (supervised) vs global (trusted). */
type TemplateTier = 'template' | 'curated_db'

function applyTemplate(
  message: string,
  tpl: { id: string; regex_pattern: string; mapping_rules: Record<string, unknown>; match_count: number; tier?: string | null },
  receivedAt?: string,
): TemplateMatch | null {
  const rules = tpl.mapping_rules as unknown as MappingRules
  if (!rules?.amount) return null
  // Same extraction path the learn-time gates verify against — see templateApply.ts.
  const got = applyMappingRules(message, tpl.regex_pattern, rules, { receivedAt })
  if (!got) return null

  const { merchant, bankName, kind } = got
  const cleanTitle =
    kind === 'atm_withdrawal'       ? `ATM Withdrawal${bankName ? ` — ${bankName}` : ''}` :
    kind === 'cc_payoff'            ? `Credit Card Payment${bankName ? ` — ${bankName}` : ''}` :
    kind === 'own_transfer'         ? `Transfer between accounts${bankName ? ` — ${bankName}` : ''}` :
    kind === 'currency_exchange'    ? `Currency Exchange${bankName ? ` — ${bankName}` : ''}` :
    kind === 'instant_transfer_out' ? `Transfer${merchant ? ` to ${merchant}` : ''}` :
    kind === 'instant_transfer_in'  ? `Transfer${merchant ? ` from ${merchant}` : ''}` :
    merchant ?? bankName ?? null

  return {
    templateId: tpl.id,
    tier: tpl.tier === 'curated_db' ? 'curated_db' : 'template',
    txDay: got.txDay,
    paymentInstrument: got.paymentInstrument,
    parsed: {
      is_transaction: true,
      amount: got.amount,
      currency: got.currency as ParsedTx['currency'],
      merchant,
      bank_name: bankName,
      category: null,
      confidence: 1.0,
      kind: kind as ParsedTx['kind'],
      cleanTitle,
      detectedAccountLast4: got.last4,
      detectedCounterpartyLast4: got.counterpartyLast4,
      merchantNormalized: null,
    },
  }
}

// Tier 2: DB templates for any of these routing keys (indexed `IN` query).
// `keys` are the transport sender and/or the body hotline — see routingKey.ts.
/**
 * Template ids this user has contributed to. A `template`-tier row applies only to its
 * contributors; `curated_db` applies to everyone.
 */
async function contributedTemplateIds(
  service: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  candidateIds: string[],
): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set()
  const { data } = await service
    .from('sms_template_users')
    .select('template_id')
    .eq('user_id', userId)
    .in('template_id', candidateIds)
  return new Set((data ?? []).map((r) => r.template_id as string))
}

/**
 * Tier-2 candidates for these routing keys. Returns BOTH what the user may parse with and what
 * may only be tested for validation evidence — a `template`-tier row this user has not
 * contributed to is exactly the row that needs independent validation, so one fetch serves both.
 */
async function fetchTemplateCandidates(
  message: string,
  keys: string[],
  service: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  receivedAt?: string,
): Promise<{
  match: TemplateMatch | null
  validationOnly: TemplateCandidate[]
  /** Quarantined templates that MATCH this message — evaluated in shadow, never used. */
  shadow: TemplateMatch[]
}> {
  // Trusted tier first, straight from memory — no query on the common path.
  for (const tpl of await getCuratedDbTemplates(service)) {
    const result = applyTemplate(message, tpl, receivedAt)
    if (result) return { match: result, validationOnly: [], shadow: [] }
  }

  const query = service
    .from('sms_tracking_templates_ai')
    .select(TEMPLATE_COLUMNS)
    .eq('ai_enabled', true)
    // Quarantined rows are fetched too: they must not PARSE, but their would-be output is
    // compared against the AI's reading so shadow mode can exonerate or retire them with no
    // user friction at all.
    .in('status', ['active', 'quarantined'])
    .is('merged_into', null)
    .order('match_count', { ascending: false })

  // Keyed lookup first; the broad scan is a FALLBACK, not an alternative — a template Android
  // learned under its transport sender is invisible to the keyed lookup for the same SMS
  // arriving sender-less from the iOS bridge.
  const { data } = keys.length
    ? await query.in('sender', keys).limit(10)
    : await query.limit(50)

  let candidates = (data ?? []) as unknown as TemplateCandidate[]
  if (keys.length && candidates.length === 0) {
    const { data: broad } = await service
      .from('sms_tracking_templates_ai')
      .select(TEMPLATE_COLUMNS)
      .eq('ai_enabled', true)
      .in('status', ['active', 'quarantined'])
      .is('merged_into', null)
      .order('match_count', { ascending: false })
      .limit(50)
    candidates = (broad ?? []) as unknown as TemplateCandidate[]
  }
  if (candidates.length === 0) return { match: null, validationOnly: [], shadow: [] }

  const quarantined = candidates.filter((c) => c.status === 'quarantined')
  candidates = candidates.filter((c) => c.status === 'active')

  const shadow: TemplateMatch[] = []
  for (const q of quarantined) {
    const r = applyTemplate(message, q, receivedAt)
    if (r) shadow.push(r)
  }

  const contributed = await contributedTemplateIds(
    service,
    userId,
    candidates.filter((c) => c.tier !== 'curated_db').map((c) => c.id),
  )
  const { usable, validationOnly } = partitionByScope(candidates, contributed)

  for (const tpl of usable) {
    const result = applyTemplate(message, tpl, receivedAt)
    if (result) return { match: result, validationOnly, shadow }
  }
  return { match: null, validationOnly, shadow }
}

/**
 * Records that `userId` has matched `templateId`, then recomputes the template's
 * distinct-user count from the junction. Templates are global (user_id null), so
 * the count cannot live on the template row alone — sms_template_users is the
 * source of truth. Best-effort; runs in after().
 */
async function recordTemplateUser(
  templateId: string,
  userId: string,
  service: ReturnType<typeof createServiceRoleClient>,
): Promise<void> {
  try {
    await service
      .from('sms_template_users')
      .upsert({ template_id: templateId, user_id: userId }, { onConflict: 'template_id,user_id', ignoreDuplicates: true })
    const { count } = await service
      .from('sms_template_users')
      .select('*', { count: 'exact', head: true })
      .eq('template_id', templateId)
    await service
      .from('sms_tracking_templates_ai')
      .update({ unique_user_count: count ?? 1 })
      .eq('id', templateId)
  } catch (e) {
    console.warn('[sms/parse] recordTemplateUser failed', e)
  }
}

// ---------------------------------------------------------------------------
// Pattern learning (async, never blocks the response)
// ---------------------------------------------------------------------------

/** A failure is stored as `<class>#<attempt>|<reason>` so the retry policy and the coverage view can read it; outcomes stay plain. */
function withFailureClass(status: string): string {
  const cls = classifyLearnStatus(status)
  return cls === 'terminal' || status === 'pending' || /^[a-z_]+#\d+\|/.test(status) ? status : encodeLearnStatus(cls, 1, status)
}

/** Persist the template-learning outcome on the parse-log row (admin-visible). */
async function recordLearnOutcome(
  service: ReturnType<typeof createServiceRoleClient>,
  logId: string,
  status: string,
  templateId: string | null = null,
): Promise<void> {
  try {
    status = withFailureClass(status)
    await service
      .from('sms_parse_log')
      .update({ learn_status: status, learn_template_id: templateId })
      .eq('id', logId)
  } catch (e) {
    console.warn('[sms/parse] recordLearnOutcome failed', e)
  }
}

type RegexAttempt =
  | { ok: true; regex: string; mapping: MappingRules }
  | { ok: false; status: string }

/**
 * One regex-generation attempt: ask Gemini for a regex, then VALIDATE it
 * compiles and matches the source SMS. Returns a failure status (never throws
 * for the expected cases) so the caller can retry — the LLM is non-deterministic
 * and a single call routinely yields no_json / a non-matching regex.
 */
async function generateMatchingRegex(
  message: string,
  sender: string,
  parsed: ParsedTx,
  apiKey: string,
  ctx: { receivedAt: string; replay: Awaited<ReturnType<typeof loadReplayCases>>; hint: string | null },
): Promise<RegexAttempt> {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: geminiHeaders(apiKey),
    // Bounded so a single attempt can't run past the route's budget; the retry
    // loop compensates for flaky calls. (15s + default thinking always aborted;
    // thinkingBudget:0 produced empty responses — a small cap is the sweet spot.)
    signal: AbortSignal.timeout(18_000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildRegexLearningPrompt(message, sender, parsed, ctx.hint) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 256 },
      },
    }),
  })
  if (!res.ok) return { ok: false, status: 'gemini_error' }

  const raw = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = raw.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const jsonStr = extractJson(text)
  if (!jsonStr) return { ok: false, status: 'no_json' }
  let learned: { regex_pattern?: string; mapping_rules?: MappingRules }
  try {
    learned = JSON.parse(jsonStr)
  } catch {
    return { ok: false, status: 'no_json' }
  }
  if (!learned.regex_pattern || !learned.mapping_rules?.amount) {
    return { ok: false, status: 'no_regex_or_amount' }
  }
  if (!isSafeRegexPattern(learned.regex_pattern)) {
    return { ok: false, status: 'regex_unsafe' }
  }
  try {
    new RegExp(learned.regex_pattern)
  } catch {
    return { ok: false, status: 'regex_invalid' }
  }
  let hit: RegExpExecArray | null
  try {
    hit = execBounded(learned.regex_pattern, '', message.slice(0, MAX_TEMPLATE_INPUT_CHARS))
  } catch {
    return { ok: false, status: 'regex_timeout' }
  }
  if (!hit) {
    return { ok: false, status: 'regex_no_match' }
  }

  // Matching is not enough. A regex can match its own sample while its capture groups point at
  // the wrong tokens — grabbing the trailing "available balance" instead of the amount is the
  // classic case, and it used to pass validation and ship as a global, fully-trusted template.
  // The gates re-extract through the SAME path production uses and require the AI's values back.
  const gate = runLearnGates(message, learned.regex_pattern, learned.mapping_rules, {
    amount: parsed.amount,
    currency: parsed.currency,
    detectedAccountLast4: parsed.detectedAccountLast4,
  }, { receivedAt: ctx.receivedAt, replay: ctx.replay })
  if (!gate.ok) {
    return { ok: false, status: `${gate.status}${gate.detail ? `: ${gate.detail}` : ''}`.slice(0, 200) }
  }

  return { ok: true, regex: learned.regex_pattern, mapping: learned.mapping_rules }
}

async function learnPattern(
  message: string,
  sender: string,
  parsed: ParsedTx,
  service: ReturnType<typeof createServiceRoleClient>,
  apiKey: string,
  userId: string,
  logId: string,
  receivedAt: string,
): Promise<void> {
  try {
    // The LLM is non-deterministic — a single call routinely returns no JSON or
    // a regex that doesn't match its own sample. Retry up to 3× and keep the
    // first attempt that compiles AND matches; record the last failure otherwise.
    let attempt: RegexAttempt = { ok: false, status: 'no_json' }
    const replay = await loadReplayCases(service, sender)
    for (let i = 0; i < 3; i++) {
      // The previous failure's class tells the next attempt what to fix.
      const hint: string | null = i === 0 ? null : decideLearnRetry(attempt.ok ? null : attempt.status, new Date()).hint
      const metered = await withSmsAiQuota(userId, SMS_PARSE_UNITS, GEMINI_MODEL, (): Promise<RegexAttempt> => generateMatchingRegex(message, sender, parsed, apiKey, { receivedAt, replay, hint }))
      if (metered.denied) return recordLearnOutcome(service, logId, 'quota_denied')
      attempt = metered.value
      if (attempt.ok) break
    }
    if (!attempt.ok) {
      console.warn('[sms/parse] pattern learning: no matching regex after retries', { sender, status: attempt.status })
      return recordLearnOutcome(service, logId, attempt.status)
    }

    const { data: bucket } = await service
      .from('sms_tracking_templates_ai')
      .select('id, regex_pattern, mapping_rules, template_sample, status')
      .eq('sender', sender)

    const siblings = bucket ?? []

    // C1 — never resurrect a retired regex. Without this the loop is: retire -> falls to AI ->
    // AI re-learns the same wrong regex -> stored again. The retirement would be undone by the
    // very mechanism it was meant to protect against.
    const retiredTwin = siblings.find(
      (t) => t.status === 'retired' && t.regex_pattern === attempt.regex,
    )
    if (retiredTwin) return recordLearnOutcome(service, logId, 'blocked_retired', retiredTwin.id)

    // C2 — behavioural merge BEFORE the cap check. Regex generation is non-deterministic, so
    // the same template arrives as many cosmetic variants; storing each one fills the
    // 10-per-key cap and then blocks the very contributors whose agreement drives promotion.
    // An equivalent sibling absorbs this user instead of adding a row.
    const twin = siblings.find((t) => {
      if (t.status === 'retired' || !t.template_sample) return false
      try {
        return behaviourallyEquivalent(
          { regex: attempt.ok ? attempt.regex : '', rules: (attempt.ok ? attempt.mapping : {}) as MappingRules, sample: message },
          { regex: t.regex_pattern, rules: t.mapping_rules as unknown as MappingRules, sample: t.template_sample },
        )
      } catch {
        return false
      }
    })
    if (twin) {
      await recordTemplateUser(twin.id, userId, service)
      await checkAndAutoPromote(sender, service, { loadReplayCases: (s) => loadReplayCases(service, s) })
      return recordLearnOutcome(service, logId, 'merged_equivalent', twin.id)
    }

    // Global cap: 10 templates per sender prevents runaway growth.
    if (senderCapReached(siblings)) return recordLearnOutcome(service, logId, 'cap_reached')

    // UNIQUE INDEX on (sender, md5(regex_pattern)) silently ignores exact duplicates.
    // user_id null = global — learned templates serve every user.
    const { data: inserted, error: tplErr } = await service.from('sms_tracking_templates_ai').insert({
      user_id: null,
      sender,
      regex_pattern: attempt.regex,
      template_sample: message.slice(0, 500),
      mapping_rules: attempt.mapping as unknown as Json,
      ai_enabled: true,
      match_count: 0,
      avg_ai_confidence: parsed.confidence ?? null,
      kind: parsed.kind ?? null,
      unique_user_count: 0,
    })
      .select('id')
      .single()

    if (tplErr && tplErr.code !== '23505') {
      console.warn('[sms/parse] template insert failed', tplErr)
      return recordLearnOutcome(service, logId, 'insert_failed')
    } else if (!tplErr && inserted) {
      console.log('[sms/parse] template learned', { sender, regex: attempt.regex })
      await recordTemplateUser(inserted.id, userId, service)
      await checkAndAutoPromote(sender, service, { loadReplayCases: (s) => loadReplayCases(service, s) })
      return recordLearnOutcome(service, logId, 'learned', inserted.id)
    } else {
      // Duplicate template (23505): record this user in the junction so the
      // distinct-user count reflects everyone whose SMS produced this regex.
      const { data: existing } = await service
        .from('sms_tracking_templates_ai')
        .select('id')
        .eq('sender', sender)
        .eq('regex_pattern', attempt.regex)
        .single()
      if (existing) await recordTemplateUser(existing.id, userId, service)
      return recordLearnOutcome(service, logId, 'duplicate', existing?.id ?? null)
    }
  } catch (e) {
    // Best-effort — never propagate, but keep the failure visible in logs + admin.
    // Capture the message so the admin row names the actual cause (timeout, etc.).
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[sms/parse] pattern learning failed', e)
    await recordLearnOutcome(service, logId, `exception: ${msg}`.slice(0, 120))
  }
}

function buildRegexLearningPrompt(message: string, sender: string, parsed: ParsedTx, hint: string | null): string {
  return `You are a regex engineer. Given a bank SMS and its extracted fields, generate a JavaScript regex to match future SMS from this sender.

SMS: ${JSON.stringify(message)}
Sender: ${JSON.stringify(sender)}
${hint ? `Previous attempt failed. ${hint}\n` : ''}Extracted: amount=${parsed.amount}, currency=${parsed.currency}, merchant=${JSON.stringify(parsed.merchant)}, kind=${parsed.kind}, last4=${parsed.detectedAccountLast4}, counterpartyLast4=${parsed.detectedCounterpartyLast4}

Rules:
- Use numbered capture groups (NOT named groups)
- Escape ALL literal special regex chars: . * ( ) [ ] { } + ? ^ $ |
- Replace EVERY run of whitespace with \\s+ (SMS spacing is irregular — double spaces, tabs, RTL marks between words)
- Replace masked account/card numbers ENTIRELY with ${MASKED_ACCOUNT_CLASS} — a mask may contain hyphens as well as stars and digits (507803******6685, 103-104***-110). Never use a class without the hyphen: it cannot match a hyphenated account and the regex then fails against its own sample.
- Use [\\d,]+\\.?\\d* for amounts that may contain comma separators
- Replace transaction-specific values (names, amounts, reference numbers, dates, times) with flexible patterns like \\S+, .+?, or \\d+
- Do NOT use ^ or $ anchors
- Keep Arabic words exactly as literals
- ALSO capture, when the SMS contains them, in their own groups:
  * the TRANSACTION DATE exactly as printed (e.g. 20-07-2026, 23/07/26, 20JUL26) -> "datetime"
  * a SECOND masked account (the destination/counterparty of a transfer) -> "counterparty_last4"
  Omit either key from mapping_rules when the SMS does not contain that value.
- The generated regex MUST match the exact SMS shown above when tested with new RegExp(regex_pattern).test(message), AND each capture group must yield exactly the extracted value listed above — verify BOTH before responding

Return JSON only (no markdown fences):
{
  "regex_pattern": "<string, no leading or trailing />",
  "mapping_rules": {
    "amount": { "group": 1, "removeCommas": true },
    "currency": { "literal": "${parsed.currency ?? 'EGP'}" },
    "merchant": { "group": 2 },
    "last4": { "group": 3 },
    "datetime": { "group": 4 },
    "counterparty_last4": { "group": 5 },
    "kind": "${parsed.kind ?? 'purchase'}",
    "bank_name": { "literal": "${parsed.bank_name ?? ''}" }
  }
}

Omit "merchant", "last4", "datetime" and "counterparty_last4" from mapping_rules when the SMS has no such value. Only include a "group" reference for values that vary per transaction.`
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

const PARSE_PER_HOUR = 1200

export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const caller = await resolveSmsCaller(request)
  const { userId, deviceId } = caller
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const blocked = await smsDeviceGate(createServiceRoleClient(), caller)
  if (blocked) {
    await recordIngestRefusal(createServiceRoleClient(), { userId, deviceId }, request, 'device_blocked')
    return blocked
  }
  // Bounds what a token holder can write (each message becomes a parse-log row, ledger rows and pushes). Fails open: a
  // database hiccup must never lose a real bank SMS.
  if (await isRateLimited(createServiceRoleClient(), `sms-parse:${userId}`, 3600, PARSE_PER_HOUR, true)) {
    return NextResponse.json({ error: 'Too many messages, try again later' }, { status: 429 })
  }

  // Parse body first — sender is needed for the static template lookup.
  let json: unknown
  try {
    json = await request.json()
  } catch {
    await recordIngestRefusal(createServiceRoleClient(), { userId, deviceId }, request, 'invalid_json')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // A bank SMS with one malformed optional field (a bad timestamp, say) is still a bank SMS: keep what validates and
  // process it. Only a body with no usable message is acknowledged without processing, so the phone can drop it
  // (nothing is lost: there is no message in it) instead of resending it forever.
  let parsedBody = bodySchema.safeParse(json)
  if (!parsedBody.success) parsedBody = bodySchema.safeParse(salvageBody(json))
  if (!parsedBody.success) {
    await recordIngestRefusal(createServiceRoleClient(), { userId, deviceId }, request, 'invalid_body')
    return NextResponse.json({ ok: false, reason: 'invalid_body' })
  }

  const { sender, source, receivedAt } = parsedBody.data
  const rawMessage = parsedBody.data.message
  const message = normalizeSmsText(rawMessage)
  const service = createServiceRoleClient()

  // sms_hash identifies the row for /api/sms/confirm + the FCM sms_confirm push.
  const eventId = parsedBody.data.eventId ?? (UUID_RE.test(request.headers.get('x-sms-event-id') ?? '') ? request.headers.get('x-sms-event-id') : null)
  const hash = computeSmsHash(rawMessage, receivedAt, eventId ?? undefined)
  const nowIso = receivedAt ?? new Date().toISOString()

  // Idempotency: a WorkManager/Shortcut retry of an SMS we already hold hits the unique (user_id, sms_hash)
  // index in the insert below, which answers with the prior row. No separate lookup.
  // The pre-filter is pure: an OTP is masked BEFORE the claim row exists, so its digits are never persisted (N3).
  const curated = matchCuratedPattern(message, sender ?? null, receivedAt ?? null)
  const rejectReason = nonTransactionReason(message, !!curated)
  const keptBody = rejectReason === 'otp' ? maskOtpDigits(message) : message
  const claimLog = () => service
    .from('sms_parse_log')
    .insert({
      user_id: userId,
      source: source ?? 'sms',
      sender: sender ?? null,
      raw_body: keptBody,
      parsed_ok: false,
      status: 'processing',
      failure_code: 'processing',
      sms_hash: hash,
      parsed_at: new Date().toISOString(),
      received_at: nowIso,
      device_id: deviceId,
      // Groups every message of one bank template, whatever merchant or amount it carries.
      shape_key: coarseShapeKey(keptBody, effectiveSender(sender, message, null)),
      // The same shape without the sender: one bank format reads the same from Android and from iPhone.
      format_key: coarseShapeKey(keptBody, null),
    })
    .select('id')
    .single()
  // The same SMS forwarded twice either side of a bucket edge hashes differently; a live claim in a neighbouring bucket is the same SMS.
  // Older builds hashed the digit-normalised text: their row for this SMS is the same SMS.
  const neighbours = [...computeNeighbourSmsHashes(rawMessage, receivedAt, eventId ?? undefined), ...computeLegacySmsHashes(rawMessage, receivedAt)]
  if (neighbours.length > 0) {
    const { data: near } = await service
      .from('sms_parse_log')
      .select('expense_id, income_id, status, parsed_at')
      .eq('user_id', userId)
      .in('sms_hash', neighbours)
      .eq('is_duplicate', false)
    const live = (near ?? []).find((r) => !isStaleClaim(r.status, r.parsed_at))
    if (live) {
      if (isClaimInFlight(live.status)) return claimInProgressResponse()
      return NextResponse.json({ ok: true, duplicate: true, expenseId: live.expense_id ?? null, incomeId: live.income_id ?? null })
    }
  }
  let { data: logRow, error: logErr } = await claimLog()

  // A retry must not be blocked by a claim that can never finish (failed attempt, or a function killed
  // mid-flight). Retire that row from the unique index and claim afresh.
  if (!logRow && logErr?.code === '23505') {
    const { data: prior } = await service
      .from('sms_parse_log')
      .select('id, status, parsed_at')
      .eq('user_id', userId)
      .eq('sms_hash', hash)
      .eq('is_duplicate', false)
      .maybeSingle()
    if (prior && isStaleClaim(prior.status, prior.parsed_at)) {
      // A claim that already posted (the link write is what died) must not be retired: the retry would post it again.
      if (await hasPostedTransaction(service, userId, prior.id)) {
        return NextResponse.json({ ok: true, duplicate: true, expenseId: null, incomeId: null })
      }
      await service.from('sms_parse_log').update({ is_duplicate: true }).eq('id', prior.id)
      ;({ data: logRow, error: logErr } = await claimLog())
    }
  }

  if (logRow && deviceId) await service.from('user_devices').update({ last_sms_at: nowIso }).eq('user_id', userId).eq('device_id', deviceId)

  if (!logRow) {
    // Concurrent duplicate: two shortcuts with different keywords matched the same SMS
    // body simultaneously. The unique index on (user_id, sms_hash) WHERE is_duplicate=false
    // catches the second insert — return the same duplicate response as the sequential path.
    if (logErr?.code === '23505') {
      const { data: prior } = await service
        .from('sms_parse_log')
        .select('expense_id, income_id, status')
        .eq('user_id', userId)
        .eq('sms_hash', hash)
        .eq('is_duplicate', false)
        .maybeSingle()
      if (prior && isClaimInFlight(prior.status)) return claimInProgressResponse()
      return NextResponse.json({
        ok: true,
        duplicate: true,
        expenseId: prior?.expense_id ?? null,
        incomeId: prior?.income_id ?? null,
      })
    }
    console.error('[sms/parse] log insert failed', logErr)
    return NextResponse.json({ ok: false, reason: 'log_insert_failed' }, { status: 500 })
  }
  const logId = logRow.id

  try {
  // ---- Pre-filter: deterministic non-transaction rejector -----------------
  // Kills OTPs / telecom marketing / balance-only SMS at ~0ms, zero AI cost.
  if (rejectReason) {
    const rejectedRow = { status: 'rejected', failure_code: 'not_transaction', parse_method: 'fully_curated', harvested_at: new Date().toISOString(), raw_body: keptBody }
    const { error: rejectErr } = await service.from('sms_parse_log').update(rejectedRow).eq('id', logId)
    if (rejectErr) await service.from('sms_parse_log').update(rejectedRow).eq('id', logId)
    after(() => recordSmsStats(service, { userId, senderKey: effectiveSender(sender, message, null), message: keptBody, rejectReason, templateId: null, currency: null, isTransaction: false, parsedOk: false, kind: null, parseMethod: 'fully_curated', currencyCode: null }))
    return NextResponse.json({ ok: false, reason: 'not_transaction', rejected: rejectReason })
  }

  // ---- Tier 1: curated pattern library (code-shipped, global) -------------
  let parsed: ParsedTx
  let patternId: string | null = null
  let paymentInstrument: string | null = null
  let txDay: string | null = null
  // AI template-learning outcome, persisted on the log row for admin visibility.
  let learnStatus: string | null = null
  /** Set when a quarantined template had to stand in because AI was unavailable (C4). */
  let quarantinedFallback = false

  // ---- Tier 2: learned DB templates -------------------------------------------
  // Key by transport sender AND/OR body hotline so a sender-less iOS SMS still
  // matches a template Android learned (and vice-versa); broad-scan when neither.
  // Keyed lookup first; the broad scan is a FALLBACK, not an alternative. A template
  // Android learned under its transport sender is invisible to the keyed lookup for the
  // same SMS arriving sender-less from the iOS bridge, and the scan is what still finds it.
  const candidateKeys = lookupKeys(sender, message)
  const templateLookup = curated
    ? null
    : await fetchTemplateCandidates(message, candidateKeys, service, userId, nowIso)
  const staticMatch = templateLookup?.match ?? null
  // Templates this user may not parse with — tested later against the AI's own reading, which
  // is how a supervised template earns the cross-user agreement that promotes it.
  const validationCandidates = templateLookup?.validationOnly ?? []
  const shadowMatches = templateLookup?.shadow ?? []

  const staticResult = staticMatch?.parsed ?? null
  const matchedTemplateId = staticMatch?.templateId ?? null

  if (curated) {
    patternId = curated.patternId
    paymentInstrument = curated.paymentInstrument
    txDay = curated.txDay
    parsed = {
      is_transaction: true,
      amount: curated.amount,
      currency: curated.currency,
      merchant: curated.counterparty,
      bank_name: curated.bank,
      category: null,
      confidence: 1.0,
      kind: curated.kind,
      cleanTitle: curated.cleanTitle,
      detectedAccountLast4: curated.last4,
      detectedCounterpartyLast4: curated.counterpartyLast4,
      merchantNormalized: null,
    }
  } else if (staticResult && staticMatch) {
    parsed = staticResult
    // Parity with the curated tier: a Curated DB / Template match now carries the SMS's own
    // transaction date and payment instrument too, instead of falling back to arrival time.
    txDay = staticMatch.txDay
    paymentInstrument = staticMatch.paymentInstrument
  } else if (shadowMatches.length > 0 && !aiAvailable(await geminiBudget(service, userId))) {
    // C4 — quarantine must never cost the user a transaction. Shadow mode routes this SMS to AI,
    // but if AI is unavailable (no key, or the user is at their daily cap) the only reading we
    // have is the quarantined template's. Use it rather than dropping the SMS, and flag the row
    // for confirmation so the uncertainty is visible instead of silent. No shadow verdict is
    // recorded: there was nothing to compare against.
    const fallback = shadowMatches[0]
    parsed = fallback.parsed
    txDay = fallback.txDay
    paymentInstrument = fallback.paymentInstrument
    quarantinedFallback = true
  } else {
    // Negative cache: the AI already judged this exact masked shape "not a transaction" (twice, and it never parsed
    // for anyone), so it is not asked again. A message a quarantined template matches still goes to the AI.
    if (shadowMatches.length === 0 && (await isKnownNonTransaction(service, message))) {
      await service.from('sms_parse_log')
        .update({ status: 'rejected', failure_code: KNOWN_NON_TRANSACTION, parse_method: 'fully_curated', harvested_at: new Date().toISOString(), masked_body: maskSkeletonText(message) })
        .eq('id', logId)
      after(() => recordSmsStats(service, { userId, senderKey: effectiveSender(sender, message, null), message, templateId: null, currency: null, isTransaction: false, parsedOk: false, kind: null, parseMethod: 'fully_curated', currencyCode: null }))
      return NextResponse.json({ ok: false, reason: 'not_transaction', rejected: 'known_shape' })
    }

    // Gemini path: API key required, rate-limited.
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      await service.from('sms_parse_log')
        .update({ status: 'failed', failure_code: 'not_configured', parse_method: 'ai_new', is_duplicate: true })
        .eq('id', logId)
      return NextResponse.json(
        { error: 'AI is not configured. Admin needs to set GEMINI_API_KEY.' },
        { status: 503 },
      )
    }

    // Rate-limit (per UTC day — counts Gemini calls only).
    if ((await aiCallsToday(service as never, userId)) >= RATE_LIMIT_PER_DAY) {
      await service.from('sms_parse_log')
        .update({ status: 'failed', failure_code: 'rate_limited', parse_method: 'ai_new', is_duplicate: true })
        .eq('id', logId)
      return NextResponse.json(
        { error: 'Daily SMS parse quota reached', limit: RATE_LIMIT_PER_DAY },
        { status: 429 },
      )
    }

    // The system's memory. If a user previously corrected a parse of this same message SHAPE,
    // that correction is injected into the prompt — otherwise the model has no recollection and
    // reproduces the identical mistake for the next user, which is exactly what made retiring a
    // template insufficient on its own.
    const exemplar = await fetchCorrectionExemplar(service, message)

    // Same wheel as every other AI surface; an SMS parse is about this many tokens in and out.
    const quota = await reserveAiQuota({ userId, feature: 'sms', estUnits: SMS_PARSE_UNITS })
    if (!quota.allowed) {
      await service.from('sms_parse_log')
        .update({ status: 'failed', failure_code: 'rate_limited', parse_method: 'ai_new', is_duplicate: true })
        .eq('id', logId)
      return quotaDeniedResponse(quota)
    }
    const geminiStarted = Date.now()
    const settleSms = (status: 'ok' | 'error') =>
      settleAiQuota(quota, { model: GEMINI_MODEL, tier: 'smart', latencyMs: Date.now() - geminiStarted, usage: { promptTokens: SMS_PARSE_UNITS, cachedTokens: 0, outputTokens: 0 }, status })

    // Call Gemini.
    try {
      parsed = await callGemini(apiKey, message, exemplar)
      await settleSms('ok')
    } catch (e) {
      await settleSms('error')
      console.error('[sms/parse] gemini failed', e)
      await service.from('sms_parse_log')
        .update({ status: 'failed', failure_code: 'gemini_error', parse_method: 'ai_new', is_duplicate: true })
        .eq('id', logId)
      // 502 → WorkManager retries with a fresh request (new log row).
      return NextResponse.json({ ok: false, reason: 'ai_failed' }, { status: 502 })
    }

    // Learn a GLOBAL regex template for this sender after the response is sent.
    // after() keeps the serverless function alive — a bare void promise is
    // frozen the moment the response returns and never completes on Vercel.
    // Learn under a stable key: hotline (cross-platform) → sender → bank name.
    const learnKey = effectiveSender(sender, message, parsed.bank_name)
    if (!parsed.is_transaction) learnStatus = 'skipped_not_tx'
    else if (!learnKey) learnStatus = 'skipped_no_key'
    else if (parsed.confidence < PATTERN_LEARN_CONFIDENCE) learnStatus = 'skipped_low_conf'
    else {
      learnStatus = 'pending' // learnPattern overwrites with its real outcome
      after(() => learnPattern(message, learnKey, parsed, service, apiKey, userId, logId, nowIso))
    }
  }

  // Which stage of the journey parsed this row — stamped for the admin audit loop.
  // Fully Curated (code) -> Curated DB (global) -> Template (author-scoped) -> AI - new SMS.
  const parseMethod: 'fully_curated' | 'curated_db' | 'template' | 'ai_new' =
    curated ? 'fully_curated'
    : staticMatch ? staticMatch.tier
    // A C4 fallback was produced by a (quarantined) template, not the AI tier — label it as such
    // so the admin panel doesn't misattribute it to AI.
    : quarantinedFallback ? 'template'
    : 'ai_new'

  // What the parser itself said, before the body is consulted: on the AI and learned-template tiers this is a guess.
  const aiBankName = parsed.bank_name
  // iOS sends no sender, so name the provider from what the message itself prints (deterministic, free, before any AI).
  if (!parsed.bank_name) parsed.bank_name = providerFromBody(message)?.name ?? null
  // Stable sender identity (hotline → sender → bank) for currency learning + pooling.
  const senderKey = effectiveSender(sender, message, parsed.bank_name)

  // Reject only true non-transactions — NEVER for a missing currency (Egyptian
  // wallet SMS often omit it). resolveCurrency backfills below.
  if (!parsed.is_transaction || !parsed.amount) {
    await service.from('sms_parse_log')
      .update({
        status: 'rejected',
        confidence: parsed.confidence ?? 0,
        failure_code: parsed.is_transaction ? 'null_amount' : 'not_transaction',
        parse_method: parseMethod,
        harvested_at: new Date().toISOString(),
        // Stamped now (the harvest would stamp the same value later) so the negative cache sees this verdict at once.
        ...(parsed.is_transaction ? {} : { masked_body: maskSkeletonText(message) }),
      })
      .eq('id', logId)
    after(() => recordSmsStats(service, { userId, senderKey, message, templateId: null, currency: null, isTransaction: false, parsedOk: false, kind: parsed.kind ?? null, parseMethod, currencyCode: null }))
    return NextResponse.json({ ok: false, reason: 'not_transaction' })
  }

  // Backfill the currency (literal → learned (user,sender) → base → EGP). When the
  // value is a guess, `provisional` flags the row for one-time user confirmation.
  const { currency: resolvedCurrency, provisional: currencyProvisional } = await resolveCurrency(service, {
    userId,
    sender: senderKey,
    rawBody: message,
    parsedCurrency: parsed.currency,
  })
  parsed.currency = resolvedCurrency

  if (parsed.confidence < CONFIRM_CONFIDENCE) {
    await service.from('sms_parse_log')
      .update({
        status: 'rejected',
        confidence: parsed.confidence,
        amount: parsed.amount,
        currency: parsed.currency,
        merchant: hasPersonCounterparty(parsed.kind) ? null : parsed.merchant,
        bank_name: parsed.bank_name,
        category: parsed.category,
        failure_code: 'low_confidence',
        parse_method: parseMethod,
        harvested_at: new Date().toISOString(),
      })
      .eq('id', logId)
    after(() => recordSmsStats(service, { userId, senderKey, message, templateId: null, currency: null, isTransaction: false, parsedOk: false, kind: parsed.kind ?? null, parseMethod, currencyCode: parsed.currency ?? null }))
    return NextResponse.json({ ok: false, reason: 'low_confidence', confidence: parsed.confidence })
  }

  // Server-side security: strip non-digits and truncate to last 4 — never trust raw output.
  const cleanLast4 = (parsed.detectedAccountLast4 ?? '').replace(/\D/g, '').slice(-4)
    || (SOURCE_ACCOUNT_KINDS.has(parsed.kind ?? '') ? extractAccountTail(message)?.slice(-4) : null)
    || null
  const cleanCpLast4 = (parsed.detectedCounterpartyLast4 ?? '').replace(/\D/g, '').slice(-4) || null

  // Prefer the transaction date embedded in the SMS body (curated patterns)
  // over the receive timestamp — they differ for delayed/offline deliveries.
  const day = txDay ?? smsLocalDay(nowIso, await getUserTimeZone(service, userId))

  const implausible = smsPlausibilityIssue(parsed.amount, day)
  if (implausible) {
    await service.from('sms_parse_log')
      .update({ status: 'rejected', confidence: parsed.confidence, amount: parsed.amount, failure_code: implausible, parse_method: parseMethod, harvested_at: new Date().toISOString() })
      .eq('id', logId)
    return NextResponse.json({ ok: false, reason: implausible })
  }

  // Classify + persist via the shared dispatcher: own-account/transfer/FX
  // pairing → CC payoff → salary dedup → ATM → subscription → purchase. Posts
  // the right record(s) (or intentionally none for paired/matched cases).
  const senderCheck = checkCreditSender(curated?.bank ?? parsed.bank_name, parsed.kind, sender)
  if (senderCheck === 'absent') console.info('[sms/parse] credit without sender (log only)', { bank: curated?.bank ?? parsed.bank_name, kind: parsed.kind })
  const senderHeld = senderCheck === 'mismatch'
  // Which bank is this from? Sender, code pattern, the body, this user's history of the digits, then other users'
  // format, in that order; the AI's bank name is only ever a suggestion. The stage is recorded with the row.
  const provider = await resolveProvider(service, {
    userId, sender, body: message, kind: parsed.kind, fromCodePattern: !!curated, parsedBankName: curated?.bank ?? aiBankName, tail: cleanLast4, formatKey: coarseShapeKey(message, null),
  })
  // Is the other party of a transfer the user themself? Compared here, on the raw name, before anything is stored
  // or masked; only the boolean goes any further.
  const counterpartyIsSelf = hasPersonCounterparty(parsed.kind) && parsed.merchant
    ? isOwnName(parsed.merchant, await ownNames(service, userId))
    : null
  // The counterparty's name as a per-user salted hash, so the two legs of one transfer can be compared on it
  // without the name ever being stored.
  const counterpartyNameHash = hasPersonCounterparty(parsed.kind) ? counterpartyHash(userId, parsed.merchant) : null
  // The payment reference as a per-user hash, kept on the log row after the text is purged so a later refund can find
  // this message by it.
  const paymentReferenceHash = referenceHash(userId, extractIpnReference(message))
  const tx: SmsTxResult = senderHeld ? heldForConfirmation(parsed.kind) : await createSmsTransaction(service, {
    userId,
    amount: parsed.amount,
    currency: parsed.currency,
    day,
    kind: parsed.kind,
    cleanTitle: parsed.cleanTitle,
    merchantNormalized: parsed.merchantNormalized,
    merchant: parsed.merchant,
    bankName: parsed.bank_name,
    categoryHint: parsed.category,
    source: source ?? 'sms',
    rawBody: message,
    sender: sender ?? null,
    last4: cleanLast4,
    counterpartyLast4: cleanCpLast4,
    receivedAtIso: nowIso,
    logId,
    matchedTemplateId,
    counterpartyIsSelf,
    providerKey: provider.bankKey,
    deviceId,
    counterpartyHash: counterpartyNameHash,
    referenceHash: paymentReferenceHash,
    // Only a code-tier match proves the kind; the AI and learned templates only assert it (P1-7).
    kindSource: parseMethod === 'fully_curated' ? 'code' : 'model',
  }, { exchangeRates: DEFAULT_MARKET_RATES })

  const { expenseId, incomeId, debtPaymentId } = tx

  // A purchase the curated/template tiers matched but couldn't categorise (AI never saw it, and
  // neither catalog nor learned cache knew the merchant) lands as 'Other'. Categorise it once, in
  // the background, and cache the answer globally so it's instant for everyone next time. Skipped
  // for ai_new — that tier already had its category shot from the full parser prompt.
  // dispatch surfaces only fixed categories (Transfer/CC Payoff/Subscription…) and returns null
  // for a plain purchase — the applied category lives on the row — so the Other check reads the DB
  // inside after() rather than trusting tx.category.
  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  if (geminiKey && expenseId && parseMethod !== 'ai_new' &&
      (tx.kind === 'purchase' || tx.kind === 'online_purchase')) {
    after(async () => {
      try {
        const { data: exp } = await service.from('expenses')
          .select('description, category').eq('id', expenseId).maybeSingle()
        // Non-Other means catalog or the learned cache already categorised it in createSmsExpense.
        if (!exp || exp.category !== 'Other') return
        const merchant = (exp.description as string | null) ?? parsed.merchant
        if (!merchant) return
        const metered = await withSmsAiQuota(userId, SMS_PARSE_UNITS, GEMINI_MODEL, () => aiCategorizeMerchant(geminiKey, merchant, message))
        if (metered.denied || !metered.value) return
        const cat = metered.value
        // The AI's answer is applied as a SUGGESTION: the row says so until the user confirms or changes it.
        await service.from('expenses').update({ category: cat, category_source: 'ai_suggested' }).eq('id', expenseId)
        // One merchant, one category: this user's earlier uncategorised purchases at the same merchant follow
        // (never for a bare company-form word, which is many merchants).
        if (!isGenericMerchant(merchant)) await service.from('expenses').update({ category: cat, category_source: 'ai_suggested' })
          .eq('user_id', userId).eq('category', 'Other').ilike('description', merchant.replace(/[\\%_]/g, (c) => `\\${c}`))
          .not('sms_log_id', 'is', null).is('deleted_at', null).is('refunded_at', null)
        await rememberMerchantCategory(service, merchant, cat, 'ai')
      } catch (e) {
        console.warn('[sms/parse] merchant categorise failed', e)
      }
    })
  }

  const isIncome = tx.outcome === 'income'
  // A weak salary match posts nothing until the user confirms: the row must stay claimable by /confirm (N1).
  // Owner audit of the ghost rows this left behind (read-only, masked; review before any repair):
  //   select id, user_id, kind, parse_method, received_at from sms_parse_log
  //   where status = 'confirmed' and parsed_ok and not is_duplicate and awaiting_confirmation = false
  //     and expense_id is null and income_id is null and debt_payment_id is null and paired_log_id is null
  //     and not exists (select 1 from expenses e where e.sms_log_id = sms_parse_log.id)
  //     and not exists (select 1 from income_events i where i.sms_log_id = sms_parse_log.id)
  //   order by received_at;
  const salaryAwaitingUser = tx.outcome === 'income_matched'
  // A debt/instalment payment that cannot be tied to one debt posts nothing until the user picks it (F11).
  const debtAwaitingUser = tx.outcome === 'awaiting_confirmation'
  // A paired transfer leg intentionally posts no row.
  const intentionalNoPost = tx.outcome === 'transfer_paired' && !expenseId
  const postedSomething = !!(expenseId || incomeId || debtPaymentId)
  const addFailed = !!tx.error || (!postedSomething && !intentionalNoPost && !salaryAwaitingUser && !debtAwaitingUser)
  if (tx.error) console.error('[sms/parse] auto-add insert failed', tx.error)

  // Provisional currency: the row IS added (auto-when-confident), but the value
  // was a guess — flag it so the user confirms the currency once.
  // Also true when a QUARANTINED template had to stand in (C4): the row is added so the user
  // keeps their transaction, but the template producing it is under suspicion, so the row is
  // surfaced for confirmation rather than trusted silently.
  const provisionalConfirm =
    (currencyProvisional || quarantinedFallback) && !addFailed && postedSomething

  const success = !addFailed && (postedSomething || salaryAwaitingUser || debtAwaitingUser)
  // Everything statistical about this SMS (keyword and sender pools, the learned sender currency, the template's
  // match count and contributor, the corpus skeleton) is ONE insert; a scheduled drain applies them in batches.
  after(() =>
    recordSmsStats(service, {
      userId,
      senderKey,
      message,
      templateId: matchedTemplateId,
      // resolveCurrency guarantees a supported code; the DB column is an enum.
      currency: success && senderKey ? { value: parsed.currency as Database['public']['Enums']['currency_code'], confirmed: !currencyProvisional } : null,
      isTransaction: success,
      parsedOk: success,
      kind: tx.kind ?? parsed.kind ?? null,
      parseMethod,
      currencyCode: parsed.currency ?? null,
    }),
  )

  const preAck = !addFailed && !provisionalConfirm && postedSomething

  // Promote the log row with the full parse result + an HONEST add status.
  // add_failed keeps parsed_ok=true and awaiting_confirmation=true so the row
  // surfaces in the in-app rescue banner and is recoverable via /api/sms/confirm.
  const { error: promoteErr } = await service
    .from('sms_parse_log')
    .update({
      parsed_ok: true,
      // A transaction that exists in-app is confirmed at once (the old separate pre-ack write), unless the row still
      // awaits the user or is a paired leg. Push delivery is tracked separately.
      status: addFailed ? 'add_failed' : tx.outcome === 'transfer_paired' ? 'paired' : preAck ? 'confirmed' : 'logged',
      ...(preAck && tx.outcome !== 'transfer_paired' ? { acked_at: new Date().toISOString(), confirmed_at: new Date().toISOString() } : {}),
      harvested_at: new Date().toISOString(),
      failure_code: senderHeld ? 'sender_mismatch' : addFailed ? 'insert_failed' : provisionalConfirm ? 'currency_provisional' : debtAwaitingUser ? 'debt_unassigned' : null,
      confidence: parsed.confidence,
      amount: parsed.amount,
      currency: parsed.currency,
      // On a transfer the counterparty is a person: their name stays in the user's own ledger title and is not
      // copied into this log column (it was stored unmasked). The comparison result is all that is kept.
      merchant: hasPersonCounterparty(tx.kind ?? parsed.kind) ? null : parsed.merchant,
      counterparty_is_self: counterpartyIsSelf,
      counterparty_hash: counterpartyNameHash,
      // A bank a trusted stage named is stored as the bank; otherwise the parser's own (possibly guessed) name stays
      // for display, with no source, so it can never be used as evidence.
      bank_name: provider.bankKey ? PAYMENT_BRANDS[provider.bankKey].name : parsed.bank_name,
      bank_source: provider.stage,
      bank_suggestion: provider.suggestion,
      // Persist the APPLIED category (e.g. Transfer / CC Payoff / Subscription) when known.
      category: tx.category ?? parsed.category,
      account_last4: cleanLast4,
      counterparty_last4: cleanCpLast4,
      reference_hash: paymentReferenceHash,
      // The APPLIED kind, for the same reason as the category above — and this one is
      // load-bearing: sms_try_pair matches siblings on this column, so writing the raw
      // parser kind would leave every reclassified leg unpairable by its own sibling.
      kind: tx.kind ?? parsed.kind,
      clean_title: parsed.cleanTitle,
      // Every tier, not only the AI: the curated and template tiers capture a raw merchant and nothing else. Purchases
      // only, because on a transfer this field is a person, not a merchant.
      merchant_normalized: hasPersonCounterparty(tx.kind ?? parsed.kind)
        ? null
        : parsed.merchantNormalized ?? (tx.kind === 'purchase' || tx.kind === 'online_purchase' ? normalizeMerchant(parsed.merchant, tx.kind) : null),
      parse_method: parseMethod,
      pattern_id: patternId,
      // B1: without this a template-parsed row has no link to the template that produced it,
      // and no failure signal can ever be attributed.
      matched_template_id: matchedTemplateId,
      payment_instrument: paymentInstrument,
      learn_status: learnStatus,
      awaiting_confirmation: addFailed || provisionalConfirm || salaryAwaitingUser || debtAwaitingUser,
      expense_id: expenseId,
      income_id: incomeId,
      debt_payment_id: debtPaymentId,
    })
    .eq('id', logId)

  if (promoteErr) {
    console.error('[sms/parse] log promote failed', promoteErr)
    // A posted transaction must not be retired as a duplicate (the retry would post it again): leave the row
    // recoverable via /confirm. With nothing posted the row stays retryable.
    await service.from('sms_parse_log').update(postedSomething
      ? { status: 'add_failed', failure_code: 'promote_failed', parsed_ok: true, awaiting_confirmation: true, expense_id: expenseId, income_id: incomeId, debt_payment_id: debtPaymentId }
      : { status: 'failed', failure_code: 'promote_failed', is_duplicate: true }).eq('id', logId)
    return NextResponse.json({ ok: false, reason: 'log_insert_failed' }, { status: 500 })
  }

  // Instant, in the foreground: nudge the user's devices to pull the delta (best effort; the push below covers the rest).
  after(() => nudgeUser(userId, 'sms', { logId }))

  // Localize push + notification copy to the account's language.
  const dict = getServerDictionary(await getUserLocale(service, userId))
  const np = dict.notifications.push
  const amountStr = `${parsed.currency} ${parsed.amount.toLocaleString()}`
  const bank = parsed.bank_name ?? ''
  const label = parsed.cleanTitle ?? parsed.merchant ?? null
  const isMovement =
    tx.category === 'Transfer' || tx.category === 'Currency Exchange' || tx.category === 'ATM Cash Withdrawal'

  // Notification feed bucket (web center) — keep to the 3 known categories.
  const notifCategory = addFailed || provisionalConfirm || debtAwaitingUser ? 'sms_confirm' : isIncome || tx.outcome === 'income_matched' ? 'sms_income' : 'sms_expense'
  const notifSeverity = addFailed || provisionalConfirm || debtAwaitingUser ? 'warning' : isIncome || tx.outcome === 'income_matched' ? 'success' : 'info'

  // Push runs in after() so Vercel keeps the function alive until delivery,
  // and the result is logged — a missing FIREBASE_SERVICE_ACCOUNT_JSON or an
  // all-stale token list shows up in the logs instead of failing silently.
  let pushArgs: SendNativePushArgs
  if (senderHeld) {
    pushArgs = {
      userId,
      title: np.smsSenderHeldTitle(amountStr),
      body: np.smsSenderHeldBody,
      data: { kind: SMS_SENDER_HELD_PUSH_KIND, hash, logId, amount: String(parsed.amount), currency: parsed.currency },
      collapseKey: `sms-held-${hash.slice(0, 12)}`,
    }
  } else if (addFailed || debtAwaitingUser) {
    pushArgs = {
      userId,
      title: np.smsConfirmTitle,
      body: np.smsConfirmBody(amountStr, label),
      data: { kind: 'sms_confirm', hash, logId, amount: String(parsed.amount), currency: parsed.currency },
      collapseKey: `sms-confirm-${hash.slice(0, 12)}`,
    }
  } else if (provisionalConfirm) {
    pushArgs = {
      userId,
      title: np.smsCurrencyConfirmTitle(amountStr),
      body: np.smsCurrencyConfirmBody(label),
      data: { kind: 'sms_currency_confirm', hash, logId, expenseId: expenseId ?? '', currency: parsed.currency ?? '' },
      collapseKey: `sms-ccy-${hash.slice(0, 12)}`,
    }
  } else if (tx.outcome === 'income_matched') {
    pushArgs = {
      userId,
      title: np.smsSalaryTitle(amountStr),
      body: tx.confirmReason === 'salary' ? np.smsSalaryDiffersBody : np.smsSalaryBody,
      data: { kind: 'sms_salary_matched', logId, sourceId: tx.matchedSourceId ?? '' },
      collapseKey: `sms-salary-${hash.slice(0, 12)}`,
    }
  } else if (tx.category === 'CC Payoff') {
    pushArgs = {
      userId,
      title: np.smsCcPayoffTitle(amountStr),
      body: np.smsCcPayoffBody(bank || 'credit'),
      data: { kind: 'sms_cc_payoff', logId, debtPaymentId: debtPaymentId ?? '' },
      collapseKey: `sms-ccpay-${hash.slice(0, 12)}`,
    }
  } else if (tx.outcome === 'subscription') {
    pushArgs = {
      userId,
      title: np.smsSubscriptionTitle(amountStr, parsed.merchantNormalized ?? parsed.merchant ?? bank),
      body: np.smsSubscriptionBody(monthNameInZone(new Date(), await getUserTimeZone(service, userId), dict.locale)),
      data: { kind: 'sms_subscription', expenseId: expenseId ?? '', logId },
      collapseKey: `sms-sub-${hash.slice(0, 12)}`,
    }
  } else if (isMovement) {
    pushArgs = {
      userId,
      title: np.smsMovementTitle(amountStr, label),
      body: np.smsMovementBody(tx.category ?? 'Transfer'),
      data: {
        kind: tx.category === 'ATM Cash Withdrawal' ? 'sms_atm' : 'sms_transfer',
        expenseId: expenseId ?? '',
        logId,
      },
      collapseKey: `sms-move-${hash.slice(0, 12)}`,
    }
  } else if (isIncome) {
    pushArgs = {
      userId,
      title: np.smsIncomeTitle(amountStr, label),
      body: np.smsIncomeBody(bank || (parsed.merchant ?? '')),
      data: { kind: 'sms_income_added', incomeId: incomeId ?? '', logId },
      collapseKey: `sms-income-${hash.slice(0, 12)}`,
    }
  } else {
    pushArgs = {
      userId,
      title: np.smsExpenseTitle(amountStr, label),
      body: np.smsExpenseBody(bank || (parsed.merchant ?? '')),
      data: { kind: 'sms_auto_added', expenseId: expenseId ?? '', logId },
      collapseKey: `sms-${hash.slice(0, 12)}`,
    }
  }

  // Also record the event in the notifications feed (web center) — no extra
  // push (the route already sends one below). Deduped on `sms:<logId>`.
  after(() =>
    emitNotification(service, {
      userId,
      category: notifCategory,
      severity: notifSeverity,
      dedupeKey: `sms:${logId}`,
      title: pushArgs.title,
      body: pushArgs.body,
      metadata: { logId, expenseId, incomeId, debtPaymentId, addFailed, outcome: tx.outcome },
      push: false,
    }),
  )

  // Try push synchronously first (FCM typically < 300 ms). Race against a 3 s
  // timeout so slow Gemini parses don't exhaust Vercel's after() budget.
  // If we win: mark immediately. If we time out: fall back to after() for
  // best-effort delivery after the response is sent.
  let pushHandledInline = false
  try {
    const pushResult = await Promise.race([
      sendNativePush(pushArgs),
      new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000)),
    ])
    if (pushResult !== 'timeout') {
      const delivered = pushResult.ok && (pushResult.sent ?? 0) > 0
      await service.rpc('sms_mark_pushed', {
        p_log_id: logId,
        p_result: pushResult as unknown as Json,
        p_delivered: delivered,
      })
      if (!delivered) console.error('[sms/parse] push not delivered', pushResult)
      pushHandledInline = true
    }
  } catch (e) {
    console.error('[sms/parse] push inline attempt failed', e)
  }

  if (!pushHandledInline) {
    after(async () => {
      try {
        const result = await sendNativePush(pushArgs)
        const delivered = result.ok && (result.sent ?? 0) > 0
        await service.rpc('sms_mark_pushed', {
          p_log_id: logId,
          p_result: result as unknown as Json,
          p_delivered: delivered,
        })
        if (!delivered) console.error('[sms/parse] push (after) not delivered', result)
      } catch (e) {
        console.error('[sms/parse] push notification (after) failed', e)
      }
    })
  }

  // The balance the bank appended feeds gap detection. After the response, never throws, independent of how the SMS was parsed.
  if (success && !addFailed) {
    after(() => recordBalanceReport({ service, userId, logId, body: message, amount: parsed.amount, last4: cleanLast4, receivedAt: nowIso, sender, bankName: parsed.bank_name }))
  }

  // Soft health checks on what a TEMPLATE extracted. Free, deterministic, no user and no AI,
  // and judged as a rate — never acted on individually, since each can be legitimately wrong
  // once. Runs entirely in after(): none of it affects the response, and R4's payment_methods
  // read must not add a query to the hot path.
  if (matchedTemplateId) {
    const tid = matchedTemplateId
    const softInputs = {
      amount: parsed.amount,
      currency: parsed.currency,
      last4: cleanLast4,
      txDay,
      receivedAt: nowIso,
    }
    // Snapshot the bucket for R3 now (the candidates are already in memory); the DB work is deferred.
    const r3Extractions = staticMatch
      ? [
          {
            templateId: staticMatch.templateId,
            fields: {
              amount: staticMatch.parsed.amount,
              currency: staticMatch.parsed.currency,
              kind: staticMatch.parsed.kind,
              last4: staticMatch.parsed.detectedAccountLast4,
            },
          },
          ...validationCandidates.flatMap((c) => {
            const rules = c.mapping_rules as unknown as MappingRules
            if (!rules?.amount) return []
            const got = applyMappingRules(message, c.regex_pattern, rules, { receivedAt: nowIso })
            return got ? [{ templateId: c.id, fields: extractionToObjective(got) }] : []
          }),
        ]
      : []

    after(async () => {
      const soft = checkPlausibility(softInputs, softInputs.receivedAt)
      // R4: currency vs the account it names — needs the user's registered methods.
      const { data: accounts } = await service
        .from('payment_methods')
        .select('last4, currency')
        .eq('user_id', userId)
        .is('deleted_at', null)
      const ccyMismatch = checkCurrencyAgainstAccount(
        softInputs.currency,
        softInputs.last4,
        (accounts ?? []) as Array<{ last4: string | null; currency: string | null }>,
      )
      if (ccyMismatch) soft.push(ccyMismatch)

      // R3: a template parsed this SMS, so no AI arbitrated. If another bucket template also
      // matched and extracted a different amount, one is provably wrong — both flagged, since
      // we can't tell which, and the rate decides.
      const contradictions = checkCrossTemplateContradiction(r3Extractions)

      const signals: Array<{ templateId: string; reason: string }> = [
        ...soft.map((s) => ({ templateId: tid, reason: `${s.code}: ${s.detail}` })),
        ...contradictions.map((c) => ({ templateId: c.templateId, reason: `${c.signal.code}: ${c.signal.detail}` })),
      ]
      for (const sig of signals) {
        try {
          await bumpTemplateFailure(service, { templateId: sig.templateId, hard: false, reason: sig.reason.slice(0, 200), userId })
        } catch (e) {
          console.warn('[sms/health] soft signal failed', e)
        }
      }
    })
  }

  // Shadow mode. A quarantined template still matched this message, but its result was NOT
  // used — the SMS was parsed independently (AI, or a trusted active/curated template). Comparing
  // the two is what decides its fate: consecutive agreements restore it to its previous tier, one
  // disagreement retires it. The user sees nothing either way.
  //
  // Skipped when a quarantined template was the ONLY reader and stood in as the C4 fallback:
  // there `parsed` IS that template's own output, so a comparison would be the template against
  // itself — always agreeing — and would exonerate it with no independent check at all.
  if (shadowMatches.length > 0 && parsed.is_transaction && parsed.amount) {
    const independentReading = {
      amount: parsed.amount,
      currency: parsed.currency,
      kind: tx.kind ?? parsed.kind,
      last4: cleanLast4,
    }
    const verdicts = computeShadowVerdicts(
      quarantinedFallback,
      shadowMatches.map((m) => ({
        templateId: m.templateId,
        fields: {
          amount: m.parsed.amount,
          currency: m.parsed.currency,
          kind: m.parsed.kind,
          last4: m.parsed.detectedAccountLast4,
        },
      })),
      independentReading,
    )
    after(async () => {
      for (const v of verdicts) {
        try {
          await service.rpc('record_sms_template_shadow', {
            p_template_id: v.templateId,
            p_agreed: v.agreed,
          })
        } catch (e) {
          console.warn('[sms/parse] shadow verdict failed', e)
        }
      }
    })
  }

  // Cross-user validation — the evidence `min_unique_users` gates promotion on.
  //
  // Only when THIS SMS was read by the AI (`ai_new`): that reading is a genuinely INDEPENDENT
  // second opinion on the supervised templates in the bucket the user isn't a contributor to. A
  // template that matches and agrees has proved itself on someone else's real message — and this
  // is the only such evidence obtainable, since regex generation is too non-deterministic for
  // byte-identity to recur. The AI call was already paid for; the opinion is free.
  //
  // Gated to `ai_new` on purpose: if a template or curated pattern produced `parsed`, the
  // "independent opinion" would be another regex's output, which could echo the same mistake and
  // inflate a distinct-user count off template-vs-template agreement rather than real evidence.
  if (parseMethod === 'ai_new' && validationCandidates.length > 0 && parsed.is_transaction && parsed.amount) {
    const aiFields = {
      amount: parsed.amount,
      currency: parsed.currency,
      kind: tx.kind ?? parsed.kind,
      last4: cleanLast4,
    }
    const outcomes = validateAgainstAiParse(message, aiFields, validationCandidates)
    if (outcomes.length > 0) {
      after(async () => {
        for (const o of outcomes) {
          try {
            if (o.result === 'agreed') {
              await recordSmsStats(service, { userId, senderKey: null, message: '', templateId: o.templateId, countMatch: false, currency: null, isTransaction: false, parsedOk: false, kind: null, parseMethod: null, currencyCode: null })
            } else {
              // Matched but extracted something else — a defect in that template, recorded as a
              // soft signal. Judged as a RATE against match_count, never as an absolute count.
              await bumpTemplateFailure(service, { templateId: o.templateId, hard: false, reason: `cross_user_disagreement: ${o.detail}`.slice(0, 200), userId })
            }
          } catch (e) {
            console.warn('[sms/parse] cross-user validation failed', e)
          }
        }
      })
    }
  }

  // Background maintenance — adjudication + the zero-variance sweep. These are questions about
  // the template population's history, not about the message in hand, so they need not run on
  // every SMS: sampling ~1-in-N keeps them timely (they fire many times a day at any real volume)
  // while sparing the hot path's after() budget, which is shared with push delivery. The
  // zero-variance query in particular is a GROUP BY that grows with the log.
  {
    const key = process.env.GEMINI_API_KEY?.trim()
    if (key && Math.random() < HEALTH_SWEEP_SAMPLE_RATE) {
      after(async () => {
        const res = await runAdjudication(service, {
          askModel: (system, user) => askModelJson(key, system, user),
        })
        if (res.adjudicated > 0) console.log('[sms/adjudication]', res)
      })
    }
  }

  return NextResponse.json({
    ok: true,
    autoAdded: !addFailed,
    addFailed,
    isIncome,
    confidence: parsed.confidence,
    amount: parsed.amount,
    currency: parsed.currency,
    merchant: parsed.merchant,
    expenseId,
    incomeId,
  })
  } catch (e) {
    // Unexpected failure (DB error, etc.) — flag the claimed row so support can see it.
    console.error('[sms/parse] unhandled exception', e)
    try {
      const posted = await hasPostedTransaction(service, userId, logId)
      await service.from('sms_parse_log')
        .update(posted
          ? { status: 'logged', failure_code: 'parse_exception', parsed_ok: true }
          : { status: 'failed', failure_code: 'parse_exception', is_duplicate: true })
        .eq('id', logId)
    } catch { /* best-effort */ }
    return NextResponse.json({ ok: false, reason: 'parse_exception' }, { status: 500 })
  }
}

/**
 * Generic JSON completion, used by background quality work (adjudication).
 *
 * Deliberately NOT routed through `callGemini`, which is bound to the parser prompt and the
 * ParsedTx shape. Returns null on any failure so the caller can leave its work pending rather
 * than record a wrong verdict.
 */
/** Remaining AI headroom for a user: null when unconfigured, else calls left today. */
async function geminiBudget(
  service: ReturnType<typeof createServiceRoleClient>,
  userId: string,
): Promise<number | null> {
  if (!process.env.GEMINI_API_KEY?.trim()) return null
  return RATE_LIMIT_PER_DAY - (await aiCallsToday(service as never, userId))
}

function aiAvailable(budget: number | null): boolean {
  return budget !== null && budget > 0
}

async function askModelJson(apiKey: string, system: string, user: string): Promise<unknown | null> {
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: geminiHeaders(apiKey),
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: system }, { text: user }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    })
    if (!res.ok) return null
    const payload = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!text) return null
    const json = extractJson(text)
    return json ? JSON.parse(json) : null
  } catch {
    return null
  }
}

/**
 * Ask the model for a merchant's spending category — used only when catalog + learned cache both
 * miss, so it runs at most once per never-seen merchant (the answer is then cached globally).
 * Returns null on any failure or an unusable answer; the caller leaves the row as 'Other'.
 */
async function aiCategorizeMerchant(
  apiKey: string, merchant: string, rawBody: string,
): Promise<ExpenseCategory | null> {
  const prompt = buildMerchantCategoryPrompt(merchant, rawBody)
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: geminiHeaders(apiKey),
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      }),
    })
    if (!res.ok) return null
    const payload = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    const json = raw ? extractJson(raw) : null
    if (!json) return null
    const cat = (JSON.parse(json) as { category?: string }).category
    return cat && (MERCHANT_CATEGORY_CHOICES as readonly string[]).includes(cat) && cat !== 'Other'
      ? (cat as ExpenseCategory)
      : null
  } catch {
    return null
  }
}

async function callGemini(apiKey: string, message: string, exemplar?: string | null): Promise<ParsedTx> {
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: SMS_PARSER_SYSTEM_PROMPT },
          ...(exemplar ? [{ text: exemplar }] : []),
          { text: `\nSMS / notification text:\n${message}` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  }

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: geminiHeaders(apiKey),
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 160)}`)
  }
  const payload = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!raw) throw new Error('Empty AI response')

  let parsed: Partial<ParsedTx> & { confidence?: number }
  try {
    const jsonStr = extractJson(raw)
    if (!jsonStr) throw new SyntaxError('no JSON object found')
    parsed = JSON.parse(jsonStr) as Partial<ParsedTx>
  } catch {
    throw new Error('AI returned invalid JSON')
  }

  return {
    is_transaction: Boolean(parsed.is_transaction),
    amount: typeof parsed.amount === 'number' ? parsed.amount : null,
    currency: parsed.currency ?? null,
    merchant: parsed.merchant ?? null,
    bank_name: parsed.bank_name ?? null,
    category: parsed.category ?? null,
    confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
    kind: parsed.kind ?? null,
    cleanTitle: parsed.cleanTitle ?? null,
    detectedAccountLast4: parsed.detectedAccountLast4 ?? null,
    detectedCounterpartyLast4: parsed.detectedCounterpartyLast4 ?? null,
    merchantNormalized: parsed.merchantNormalized ?? null,
  }
}
