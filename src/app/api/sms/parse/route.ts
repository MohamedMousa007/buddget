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
import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { SMS_PARSER_SYSTEM_PROMPT, MASKED_ACCOUNT_CLASS } from '@/lib/sms/aiParserPrompt'
import { sendNativePush, type SendNativePushArgs } from '@/lib/server/sendNativePush'
import { matchCuratedPattern } from '@/lib/sms/patterns'
import { applyMappingRules, type MappingRules } from '@/lib/sms/templateApply'
import { runLearnGates } from '@/lib/sms/learnGates'
import {
  partitionByScope,
  validateAgainstAiParse,
  behaviourallyEquivalent,
  type TemplateCandidate,
} from '@/lib/sms/templateScope'
import { isNonTransaction } from '@/lib/sms/patterns/preFilter'
import { checkAndAutoPromote } from '@/lib/sms/promotionChecker'
import { lookupKeys, effectiveSender } from '@/lib/sms/routingKey'
import { createSmsTransaction, type SmsTxResult } from '@/lib/sms/dispatch'
import { DEFAULT_MARKET_RATES } from '@/lib/store/defaultFinanceData'
import { resolveCurrency } from '@/lib/sms/currencyResolver'
import { extractKeywords } from '@/lib/sms/keywordExtractor'
import { getServerDictionary } from '@/lib/i18n/getServerDictionary'
import { getUserLocale } from '@/lib/server/userLocale'
import { emitNotification } from '@/lib/server/emitNotification'

// Gemini takes 5–8 s and after() work (push + 15 s pattern learning) counts
// toward the function cap — the default would kill learning mid-call.
export const maxDuration = 60

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const RATE_LIMIT_PER_DAY = 100
const CONFIRM_CONFIDENCE = 0.6
const PATTERN_LEARN_CONFIDENCE = 0.9

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  sender: z.string().max(120).nullable().optional(),
  source: z.enum(['sms', 'notification', 'manual']).optional(),
  receivedAt: z.string().datetime({ offset: true }).optional(),
})

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

/**
 * Dedup hash over the normalized raw SMS body. Computed BEFORE any parsing so
 * the claim row can gate concurrent/retried requests with zero Gemini cost.
 */
function computeSmsHash(message: string): string {
  const normalized = message.trim().replace(/\s+/g, ' ').toLowerCase()
  return crypto.createHash('sha256').update(normalized).digest('hex')
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
): TemplateMatch | null {
  const rules = tpl.mapping_rules as unknown as MappingRules
  if (!rules?.amount) return null
  // Same extraction path the learn-time gates verify against — see templateApply.ts.
  const got = applyMappingRules(message, tpl.regex_pattern, rules)
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
const TEMPLATE_COLUMNS =
  'id, regex_pattern, mapping_rules, match_count, kind, tier, status, template_sample'

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
): Promise<{ match: TemplateMatch | null; validationOnly: TemplateCandidate[] }> {
  const query = service
    .from('sms_tracking_templates_ai')
    .select(TEMPLATE_COLUMNS)
    .eq('ai_enabled', true)
    .eq('status', 'active')
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
      .eq('status', 'active')
      .is('merged_into', null)
      .order('match_count', { ascending: false })
      .limit(50)
    candidates = (broad ?? []) as unknown as TemplateCandidate[]
  }
  if (candidates.length === 0) return { match: null, validationOnly: [] }

  const contributed = await contributedTemplateIds(
    service,
    userId,
    candidates.filter((c) => c.tier !== 'curated_db').map((c) => c.id),
  )
  const { usable, validationOnly } = partitionByScope(candidates, contributed)

  for (const tpl of usable) {
    const result = applyTemplate(message, tpl)
    if (result) return { match: result, validationOnly }
  }
  return { match: null, validationOnly }
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

/** Persist the template-learning outcome on the parse-log row (admin-visible). */
async function recordLearnOutcome(
  service: ReturnType<typeof createServiceRoleClient>,
  logId: string,
  status: string,
  templateId: string | null = null,
): Promise<void> {
  try {
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
): Promise<RegexAttempt> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Bounded so a single attempt can't run past the route's budget; the retry
    // loop compensates for flaky calls. (15s + default thinking always aborted;
    // thinkingBudget:0 produced empty responses — a small cap is the sweet spot.)
    signal: AbortSignal.timeout(18_000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildRegexLearningPrompt(message, sender, parsed) }] }],
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
  let re: RegExp
  try {
    re = new RegExp(learned.regex_pattern)
  } catch {
    return { ok: false, status: 'regex_invalid' }
  }
  if (!re.test(message)) {
    return { ok: false, status: `regex_no_match: ${learned.regex_pattern}`.slice(0, 200) }
  }

  // Matching is not enough. A regex can match its own sample while its capture groups point at
  // the wrong tokens — grabbing the trailing "available balance" instead of the amount is the
  // classic case, and it used to pass validation and ship as a global, fully-trusted template.
  // The gates re-extract through the SAME path production uses and require the AI's values back.
  const gate = runLearnGates(message, learned.regex_pattern, learned.mapping_rules, {
    amount: parsed.amount,
    currency: parsed.currency,
    detectedAccountLast4: parsed.detectedAccountLast4,
  })
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
): Promise<void> {
  try {
    // The LLM is non-deterministic — a single call routinely returns no JSON or
    // a regex that doesn't match its own sample. Retry up to 3× and keep the
    // first attempt that compiles AND matches; record the last failure otherwise.
    let attempt: RegexAttempt = { ok: false, status: 'no_json' }
    for (let i = 0; i < 3; i++) {
      attempt = await generateMatchingRegex(message, sender, parsed, apiKey)
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
      await checkAndAutoPromote(sender, service)
      return recordLearnOutcome(service, logId, 'merged_equivalent', twin.id)
    }

    // Global cap: 10 templates per sender prevents runaway growth.
    if (siblings.length >= 10) return recordLearnOutcome(service, logId, 'cap_reached')

    // UNIQUE INDEX on (sender, md5(regex_pattern)) silently ignores exact duplicates.
    // user_id null = global — learned templates serve every user.
    const { data: inserted, error: tplErr } = await service.from('sms_tracking_templates_ai').insert({
      user_id: null,
      sender,
      regex_pattern: attempt.regex,
      template_sample: message.slice(0, 500),
      mapping_rules: attempt.mapping as unknown as Record<string, unknown>,
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
      await checkAndAutoPromote(sender, service)
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

function buildRegexLearningPrompt(message: string, sender: string, parsed: ParsedTx): string {
  return `You are a regex engineer. Given a bank SMS and its extracted fields, generate a JavaScript regex to match future SMS from this sender.

SMS: ${JSON.stringify(message)}
Sender: ${JSON.stringify(sender)}
Extracted: amount=${parsed.amount}, currency=${parsed.currency}, merchant=${JSON.stringify(parsed.merchant)}, kind=${parsed.kind}, last4=${parsed.detectedAccountLast4}, counterpartyLast4=${parsed.detectedCounterpartyLast4}

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

async function resolveUserId(req: Request): Promise<{ userId: string | null }> {
  const auth = req.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!bearer) return { userId: null }
  const service = createServiceRoleClient()

  // First try Supabase JWT (mobile shell forwards `session.access_token`).
  const { data: jwtUser } = await service.auth.getUser(bearer)
  if (jwtUser?.user) return { userId: jwtUser.user.id }

  // Fallback: bearer token from sms_ingest_tokens (legacy / shortcut bridge).
  const { data: tokenRow } = await service
    .from('sms_ingest_tokens')
    .select('user_id')
    .eq('token', bearer)
    .eq('is_active', true)
    .single()

  return { userId: tokenRow?.user_id ?? null }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const { userId } = await resolveUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body first — sender is needed for the static template lookup.
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsedBody = bodySchema.safeParse(json)
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsedBody.error.flatten() },
      { status: 400 },
    )
  }

  const { message, sender, source, receivedAt } = parsedBody.data
  const service = createServiceRoleClient()

  // ponytail: self-healing — resolve rows stuck at 'processing' >2 min (Vercel kill before DB update)
  void service.from('sms_parse_log')
    .update({ status: 'failed', failure_code: 'timed_out' })
    .eq('user_id', userId)
    .eq('status', 'processing')
    .lt('parsed_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())

  // sms_hash identifies the row for /api/sms/confirm + the FCM sms_confirm push.
  const hash = computeSmsHash(message)
  const nowIso = receivedAt ?? new Date().toISOString()

  // Idempotency: a WorkManager/Shortcut retry of an SMS that already produced a
  // transaction (or is awaiting confirmation) must not post a duplicate.
  const { data: priorRows } = await service
    .from('sms_parse_log')
    .select('id, expense_id, income_id, debt_payment_id, awaiting_confirmation, status, paired_log_id')
    .eq('user_id', userId)
    .eq('sms_hash', hash)
    .neq('status', 'rejected')
    .limit(5)
  const dupe = (priorRows ?? []).find(
    (r) =>
      r.expense_id ||
      r.income_id ||
      r.debt_payment_id ||
      r.awaiting_confirmation ||
      r.paired_log_id ||
      r.status === 'processing',
  )
  if (dupe) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      expenseId: dupe.expense_id ?? null,
      incomeId: dupe.income_id ?? null,
    })
  }

  const { data: logRow, error: logErr } = await service
    .from('sms_parse_log')
    .insert({
      user_id: userId,
      source: source ?? 'sms',
      sender: sender ?? null,
      raw_body: message,
      parsed_ok: false,
      status: 'processing',
      failure_code: 'processing',
      sms_hash: hash,
      parsed_at: new Date().toISOString(),
      received_at: nowIso,
    })
    .select('id')
    .single()

  if (!logRow) {
    // Concurrent duplicate: two shortcuts with different keywords matched the same SMS
    // body simultaneously. The unique index on (user_id, sms_hash) WHERE is_duplicate=false
    // catches the second insert — return the same duplicate response as the sequential path.
    if (logErr?.code === '23505') {
      const { data: prior } = await service
        .from('sms_parse_log')
        .select('expense_id, income_id')
        .eq('user_id', userId)
        .eq('sms_hash', hash)
        .eq('is_duplicate', false)
        .maybeSingle()
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
  const rejectReason = isNonTransaction(message)
  if (rejectReason) {
    await service.from('sms_parse_log')
      .update({ status: 'rejected', failure_code: 'not_transaction', parse_method: 'fully_curated' })
      .eq('id', logId)
    return NextResponse.json({ ok: false, reason: 'not_transaction', rejected: rejectReason })
  }

  // ---- Tier 1: curated pattern library (code-shipped, global) -------------
  let parsed: ParsedTx
  let patternId: string | null = null
  let paymentInstrument: string | null = null
  let txDay: string | null = null
  // AI template-learning outcome, persisted on the log row for admin visibility.
  let learnStatus: string | null = null

  const curated = matchCuratedPattern(message, sender ?? null)

  // ---- Tier 2: learned DB templates -------------------------------------------
  // Key by transport sender AND/OR body hotline so a sender-less iOS SMS still
  // matches a template Android learned (and vice-versa); broad-scan when neither.
  // Keyed lookup first; the broad scan is a FALLBACK, not an alternative. A template
  // Android learned under its transport sender is invisible to the keyed lookup for the
  // same SMS arriving sender-less from the iOS bridge, and the scan is what still finds it.
  const candidateKeys = lookupKeys(sender, message)
  const templateLookup = curated
    ? null
    : await fetchTemplateCandidates(message, candidateKeys, service, userId)
  const staticMatch = templateLookup?.match ?? null
  // Templates this user may not parse with — tested later against the AI's own reading, which
  // is how a supervised template earns the cross-user agreement that promotes it.
  const validationCandidates = templateLookup?.validationOnly ?? []

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
  } else {
    // Gemini path: API key required, rate-limited.
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      await service.from('sms_parse_log')
        .update({ status: 'failed', failure_code: 'not_configured', parse_method: 'ai_new' })
        .eq('id', logId)
      return NextResponse.json(
        { error: 'AI is not configured. Admin needs to set GEMINI_API_KEY.' },
        { status: 503 },
      )
    }

    // Rate-limit (per UTC day — counts Gemini calls only).
    const { data: usage } = await service
      .from('sms_parse_today')
      .select('parsed_count_today')
      .eq('user_id', userId)
      .maybeSingle()

    if ((usage?.parsed_count_today ?? 0) >= RATE_LIMIT_PER_DAY) {
      await service.from('sms_parse_log')
        .update({ status: 'failed', failure_code: 'rate_limited', parse_method: 'ai_new' })
        .eq('id', logId)
      return NextResponse.json(
        { error: 'Daily SMS parse quota reached', limit: RATE_LIMIT_PER_DAY },
        { status: 429 },
      )
    }

    // Call Gemini.
    try {
      parsed = await callGemini(apiKey, message)
    } catch (e) {
      console.error('[sms/parse] gemini failed', e)
      await service.from('sms_parse_log')
        .update({ status: 'failed', failure_code: 'gemini_error', parse_method: 'ai_new' })
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
      after(() => learnPattern(message, learnKey, parsed, service, apiKey, userId, logId))
    }
  }

  // Which stage of the journey parsed this row — stamped for the admin audit loop.
  // Fully Curated (code) -> Curated DB (global) -> Template (author-scoped) -> AI - new SMS.
  const parseMethod: 'fully_curated' | 'curated_db' | 'template' | 'ai_new' =
    curated ? 'fully_curated' : staticMatch ? staticMatch.tier : 'ai_new'

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
      })
      .eq('id', logId)
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
        merchant: parsed.merchant,
        bank_name: parsed.bank_name,
        category: parsed.category,
        failure_code: 'low_confidence',
        parse_method: parseMethod,
      })
      .eq('id', logId)
    return NextResponse.json({ ok: false, reason: 'low_confidence', confidence: parsed.confidence })
  }

  // Server-side security: strip non-digits and truncate to last 4 — never trust raw output.
  const cleanLast4 = (parsed.detectedAccountLast4 ?? '').replace(/\D/g, '').slice(-4) || null
  const cleanCpLast4 = (parsed.detectedCounterpartyLast4 ?? '').replace(/\D/g, '').slice(-4) || null

  // Prefer the transaction date embedded in the SMS body (curated patterns)
  // over the receive timestamp — they differ for delayed/offline deliveries.
  const day = txDay ?? nowIso.slice(0, 10)

  // Classify + persist via the shared dispatcher: own-account/transfer/FX
  // pairing → CC payoff → salary dedup → ATM → subscription → purchase. Posts
  // the right record(s) (or intentionally none for paired/matched cases).
  const tx: SmsTxResult = await createSmsTransaction(service, {
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
  }, { exchangeRates: DEFAULT_MARKET_RATES })

  const { expenseId, incomeId, debtPaymentId } = tx
  const isIncome = tx.outcome === 'income'
  // Some outcomes intentionally post no row (paired transfer leg / matched salary).
  const intentionalNoPost =
    tx.outcome === 'income_matched' || (tx.outcome === 'transfer_paired' && !expenseId)
  const postedSomething = !!(expenseId || incomeId || debtPaymentId)
  const addFailed = !!tx.error || (!postedSomething && !intentionalNoPost)
  if (tx.error) console.error('[sms/parse] auto-add insert failed', tx.error)

  // Provisional currency: the row IS added (auto-when-confident), but the value
  // was a guess — flag it so the user confirms the currency once.
  const provisionalConfirm = currencyProvisional && !addFailed && postedSomething

  // Learn the (user, sender) currency for next time — confirmed when it came from
  // a literal/known mapping, provisional otherwise. Best-effort, after response.
  if (senderKey && !addFailed && (postedSomething || tx.outcome === 'income_matched')) {
    const learnConfirmed = !currencyProvisional
    const ccy = parsed.currency
    after(() => service.rpc('learn_sms_sender_currency', {
      p_user: userId, p_sender: senderKey, p_currency: ccy, p_confirmed: learnConfirmed,
    }))
  }

  // Keyword + sender frequency pools (Phase-2 data). Collect from any confirmed
  // transaction tier (curated/template/AI), best-effort, after the response.
  if (!addFailed && (postedSomething || tx.outcome === 'income_matched')) {
    const tokens = extractKeywords(message)
    after(async () => {
      try {
        if (senderKey) await service.rpc('bump_sms_sender', { p_sender: senderKey, p_is_txn: true })
        for (const tk of tokens) {
          await service.rpc('bump_sms_keyword', { p_keyword: tk.keyword, p_lang: tk.lang })
        }
      } catch (e) {
        console.warn('[sms/parse] keyword pooling failed', e)
      }
    })
  }

  // Promote the log row with the full parse result + an HONEST add status.
  // add_failed keeps parsed_ok=true and awaiting_confirmation=true so the row
  // surfaces in the in-app rescue banner and is recoverable via /api/sms/confirm.
  const { error: promoteErr } = await service
    .from('sms_parse_log')
    .update({
      parsed_ok: true,
      status: addFailed ? 'add_failed' : tx.outcome === 'transfer_paired' ? 'paired' : 'logged',
      failure_code: addFailed ? 'insert_failed' : provisionalConfirm ? 'currency_provisional' : null,
      confidence: parsed.confidence,
      amount: parsed.amount,
      currency: parsed.currency,
      merchant: parsed.merchant,
      bank_name: parsed.bank_name,
      // Persist the APPLIED category (e.g. Transfer / CC Payoff / Subscription) when known.
      category: tx.category ?? parsed.category,
      account_last4: cleanLast4,
      counterparty_last4: cleanCpLast4,
      // The APPLIED kind, for the same reason as the category above — and this one is
      // load-bearing: sms_try_pair matches siblings on this column, so writing the raw
      // parser kind would leave every reclassified leg unpairable by its own sibling.
      kind: tx.kind ?? parsed.kind,
      clean_title: parsed.cleanTitle,
      merchant_normalized: parsed.merchantNormalized ?? null,
      parse_method: parseMethod,
      pattern_id: patternId,
      // B1: without this a template-parsed row has no link to the template that produced it,
      // and no failure signal can ever be attributed.
      matched_template_id: matchedTemplateId,
      payment_instrument: paymentInstrument,
      learn_status: learnStatus,
      awaiting_confirmation: addFailed || provisionalConfirm,
      expense_id: expenseId,
      income_id: incomeId,
      debt_payment_id: debtPaymentId,
    })
    .eq('id', logId)

  if (promoteErr) {
    console.error('[sms/parse] log promote failed', promoteErr)
    return NextResponse.json({ ok: false, reason: 'log_insert_failed' }, { status: 500 })
  }

  // Server-side pre-ack: the transaction exists in-app now, so confirm it
  // immediately instead of leaving it "Not confirmed" for hours until the native
  // app opens and the client catch-up ACK fires. Push delivery is tracked
  // separately. Only for rows where a transaction was actually created or matched.
  if (!addFailed && !provisionalConfirm && (postedSomething || tx.outcome === 'income_matched')) {
    await service.rpc('sms_mark_acked', { p_log_id: logId, p_user_id: userId })
  }

  // Localize push + notification copy to the account's language.
  const np = getServerDictionary(await getUserLocale(service, userId)).notifications.push
  const amountStr = `${parsed.currency} ${parsed.amount.toLocaleString()}`
  const bank = parsed.bank_name ?? ''
  const label = parsed.cleanTitle ?? parsed.merchant ?? null
  const isMovement =
    tx.category === 'Transfer' || tx.category === 'Currency Exchange' || tx.category === 'ATM Cash Withdrawal'

  // Notification feed bucket (web center) — keep to the 3 known categories.
  const notifCategory = addFailed || provisionalConfirm ? 'sms_confirm' : isIncome || tx.outcome === 'income_matched' ? 'sms_income' : 'sms_expense'
  const notifSeverity = addFailed || provisionalConfirm ? 'warning' : isIncome || tx.outcome === 'income_matched' ? 'success' : 'info'

  // Push runs in after() so Vercel keeps the function alive until delivery,
  // and the result is logged — a missing FIREBASE_SERVICE_ACCOUNT_JSON or an
  // all-stale token list shows up in the logs instead of failing silently.
  let pushArgs: SendNativePushArgs
  if (addFailed) {
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
      title: np.smsSubscriptionTitle(amountStr, label),
      body: np.smsSubscriptionBody(parsed.merchantNormalized ?? parsed.merchant ?? bank),
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
        p_result: pushResult,
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
          p_result: result,
          p_delivered: delivered,
        })
        if (!delivered) console.error('[sms/parse] push (after) not delivered', result)
      } catch (e) {
        console.error('[sms/parse] push notification (after) failed', e)
      }
    })
  }

  // Cross-user validation. This user's SMS reached the AI tier, so the AI's reading is an
  // INDEPENDENT second opinion on every supervised template in the bucket that this user is not
  // a contributor to. A template that matches and agrees has just proved itself on someone
  // else's real message — which is the evidence `min_unique_users` gates promotion on, and the
  // only kind obtainable, since regex generation is too non-deterministic for byte-identity to
  // ever recur. The AI call was already paid for; the second opinion is free.
  if (validationCandidates.length > 0 && parsed.is_transaction && parsed.amount) {
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
              await recordTemplateUser(o.templateId, userId, service)
            } else {
              // Matched but extracted something else — a defect in that template, recorded as a
              // soft signal. Judged as a RATE against match_count, never as an absolute count.
              await service.rpc('bump_sms_template_failure', {
                p_template_id: o.templateId,
                p_hard: false,
                p_reason: `cross_user_disagreement: ${o.detail}`.slice(0, 200),
              })
            }
          } catch (e) {
            console.warn('[sms/parse] cross-user validation failed', e)
          }
        }
      })
    }
  }

  // Record this user against the matched template for an accurate distinct-user count
  // (drives the promotion min_unique_users gate).
  if (matchedTemplateId) {
    const tid = matchedTemplateId
    after(async () => {
      // `match_count` gates promotion (min_match_count) and is the only evidence in the
      // admin panel that a learned template does anything. A bare `void rpc(...)` at match
      // time is frozen the instant the response returns, so every template sat at 0 matches
      // forever and nothing could ever become eligible.
      await service.rpc('increment_sms_template_match_count', { p_id: tid })
      await recordTemplateUser(tid, userId, service)
    })
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
      await service.from('sms_parse_log')
        .update({ status: 'failed', failure_code: 'parse_exception' })
        .eq('id', logId)
    } catch { /* best-effort */ }
    return NextResponse.json({ ok: false, reason: 'parse_exception' }, { status: 500 })
  }
}

async function callGemini(apiKey: string, message: string): Promise<ParsedTx> {
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: SMS_PARSER_SYSTEM_PROMPT },
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

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
