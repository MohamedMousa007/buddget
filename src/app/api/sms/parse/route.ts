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
import { SMS_PARSER_SYSTEM_PROMPT } from '@/lib/sms/aiParserPrompt'
import { sendNativePush, type SendNativePushArgs } from '@/lib/server/sendNativePush'
import { matchCuratedPattern } from '@/lib/sms/patterns'
import { isNonTransaction } from '@/lib/sms/patterns/preFilter'
import { checkAndAutoPromote } from '@/lib/sms/promotionChecker'

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
        'instant_transfer_in' | 'income' | 'refund' | 'fee' | 'other' | null
  cleanTitle: string | null
  rawSmsSummary: string | null
  detectedAccountLast4: string | null
  newBalance: number | null
  merchantNormalized: string | null
}

/**
 * JSONB schema stored in `sms_tracking_templates_ai.mapping_rules`.
 * Defines how regex capture groups map to ParsedTx fields.
 */
interface MappingRules {
  amount:    { group: number; removeCommas?: boolean }
  currency?: { group: number } | { literal: string }
  merchant?: { group: number }
  last4?:    { group: number }
  kind:      string
  bank_name?:{ literal: string }
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

interface TemplateMatch { parsed: ParsedTx; templateId: string }

function applyTemplate(
  message: string,
  tpl: { id: string; regex_pattern: string; mapping_rules: Record<string, unknown>; match_count: number },
  service: ReturnType<typeof createServiceRoleClient>,
): TemplateMatch | null {
  let re: RegExp
  try { re = new RegExp(tpl.regex_pattern) } catch { return null }

  const m = re.exec(message)
  if (!m) return null

  try {
    const rules = tpl.mapping_rules as unknown as MappingRules

    const rawAmt = m[rules.amount.group] ?? ''
    const amtStr = rules.amount.removeCommas ? rawAmt.replace(/,/g, '') : rawAmt
    const amount = parseFloat(amtStr)
    if (!amount || !Number.isFinite(amount)) return null

    const cRules = rules.currency
    const currency = !cRules ? null
      : 'literal' in cRules ? cRules.literal
      : (m[cRules.group] ?? null)

    const merchant  = rules.merchant ? (m[rules.merchant.group] ?? null) : null
    const last4Raw  = rules.last4    ? (m[rules.last4.group]    ?? null) : null
    const cleanLast4 = last4Raw ? last4Raw.replace(/\D/g, '').slice(-4) || null : null
    const bankName  = rules.bank_name ? rules.bank_name.literal : null
    const kind      = rules.kind as ParsedTx['kind']

    const cleanTitle =
      kind === 'atm_withdrawal'       ? `ATM Withdrawal${bankName ? ` — ${bankName}` : ''}` :
      kind === 'instant_transfer_out' ? `Transfer${merchant ? ` to ${merchant}` : ''}` :
      kind === 'instant_transfer_in'  ? `Transfer${merchant ? ` from ${merchant}` : ''}` :
      merchant ?? bankName ?? null

    void service.rpc('increment_sms_template_match_count', { p_id: tpl.id })

    return {
      templateId: tpl.id,
      parsed: {
        is_transaction: true, amount,
        currency: currency as ParsedTx['currency'],
        merchant, bank_name: bankName,
        category: null, confidence: 1.0, kind,
        cleanTitle, rawSmsSummary: null,
        detectedAccountLast4: cleanLast4,
        newBalance: null, merchantNormalized: null,
      },
    }
  } catch { return null }
}

// Tier 2: all DB templates for this sender (direct, indexed query — ~1-3ms).
async function tryStaticParse(
  message: string,
  sender: string,
  service: ReturnType<typeof createServiceRoleClient>,
): Promise<TemplateMatch | null> {
  const { data } = await service
    .from('sms_tracking_templates_ai')
    .select('id, regex_pattern, mapping_rules, match_count, kind')
    .eq('sender', sender)
    .eq('ai_enabled', true)
    .order('match_count', { ascending: false })
    .limit(10)
  for (const tpl of data ?? []) {
    const result = applyTemplate(message, tpl, service)
    if (result) return result
  }
  return null
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

async function learnPattern(
  message: string,
  sender: string,
  parsed: ParsedTx,
  service: ReturnType<typeof createServiceRoleClient>,
  apiKey: string,
  userId: string,
): Promise<void> {
  try {
    // Global cap: 10 templates per sender prevents runaway growth
    const { count } = await service
      .from('sms_tracking_templates_ai')
      .select('*', { count: 'exact', head: true })
      .eq('sender', sender)
    if ((count ?? 0) >= 10) return

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildRegexLearningPrompt(message, sender, parsed) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
    })
    if (!res.ok) return

    const raw = (await res.json()) as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> }
    const text = raw.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const jsonStr = extractJson(text)
    if (!jsonStr) {
      console.warn('[sms/parse] pattern learning: Gemini returned no JSON', { sender, text: text.slice(0, 200) })
      return
    }
    const learned = JSON.parse(jsonStr) as { regex_pattern?: string; mapping_rules?: MappingRules }
    if (!learned.regex_pattern || !learned.mapping_rules?.amount) {
      console.warn('[sms/parse] pattern learning: missing regex_pattern or amount rule', { sender, learned })
      return
    }

    // Validate: must compile AND match the original message
    const re = new RegExp(learned.regex_pattern)
    if (!re.test(message)) {
      console.warn('[sms/parse] learned regex rejected (no match)', {
        sender, regex: learned.regex_pattern,
      })
      return
    }

    // UNIQUE INDEX on (sender, md5(regex_pattern)) silently ignores exact duplicates.
    // user_id null = global — learned templates serve every user.
    const { data: inserted, error: tplErr } = await service.from('sms_tracking_templates_ai').insert({
      user_id: null,
      sender,
      regex_pattern: learned.regex_pattern,
      template_sample: message.slice(0, 500),
      mapping_rules: learned.mapping_rules as unknown as Record<string, unknown>,
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
    } else if (!tplErr && inserted) {
      console.log('[sms/parse] template learned', { sender, regex: learned.regex_pattern })
      await recordTemplateUser(inserted.id, userId, service)
      await checkAndAutoPromote(sender, service)
    } else {
      // Duplicate template (23505): record this user in the junction so the
      // distinct-user count reflects everyone whose SMS produced this regex.
      const { data: existing } = await service
        .from('sms_tracking_templates_ai')
        .select('id')
        .eq('sender', sender)
        .eq('regex_pattern', learned.regex_pattern)
        .single()
      if (existing) await recordTemplateUser(existing.id, userId, service)
    }
  } catch (e) {
    // Best-effort — never propagate, but keep the failure visible in logs.
    console.warn('[sms/parse] pattern learning failed', e)
  }
}

function buildRegexLearningPrompt(message: string, sender: string, parsed: ParsedTx): string {
  return `You are a regex engineer. Given a bank SMS and its extracted fields, generate a JavaScript regex to match future SMS from this sender.

SMS: ${JSON.stringify(message)}
Sender: ${JSON.stringify(sender)}
Extracted: amount=${parsed.amount}, currency=${parsed.currency}, merchant=${JSON.stringify(parsed.merchant)}, kind=${parsed.kind}, last4=${parsed.detectedAccountLast4}

Rules:
- Use numbered capture groups (NOT named groups)
- Escape ALL literal special regex chars: . * ( ) [ ] { } + ? ^ $ |
- Use [\\d,]+\\.?\\d* for amounts that may contain comma separators
- Replace transaction-specific values (names, amounts, reference numbers) with flexible patterns like \\S+, .+?, or \\d+
- The generated regex MUST match the exact SMS shown above when tested with new RegExp(regex_pattern).test(message)

Return JSON only (no markdown fences):
{
  "regex_pattern": "<string, no leading or trailing />",
  "mapping_rules": {
    "amount": { "group": 1, "removeCommas": true },
    "currency": { "literal": "${parsed.currency ?? 'EGP'}" },
    "merchant": { "group": 2 },
    "last4": { "group": 3 },
    "kind": "${parsed.kind ?? 'purchase'}",
    "bank_name": { "literal": "${parsed.bank_name ?? ''}" }
  }
}

Omit "merchant" and "last4" from mapping_rules if those fields were null. Only include a "group" reference for values that vary per transaction.`
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

  // sms_hash stays as a row identifier — /api/sms/confirm and the FCM
  // sms_confirm push look rows up by hash. It no longer gates duplicates.
  const hash = computeSmsHash(message)
  const nowIso = receivedAt ?? new Date().toISOString()

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
      .update({ status: 'rejected', failure_code: 'not_transaction', parse_method: 'curated' })
      .eq('id', logId)
    return NextResponse.json({ ok: false, reason: 'not_transaction', rejected: rejectReason })
  }

  // ---- Tier 1: curated pattern library (code-shipped, global) -------------
  let parsed: ParsedTx
  let patternId: string | null = null
  let paymentInstrument: string | null = null
  let txDay: string | null = null

  const curated = matchCuratedPattern(message, sender ?? null)

  // ---- Tier 2: all DB templates (10 min cache) --------------------------------
  const staticMatch = (!curated && sender)
    ? await tryStaticParse(message, sender, service)
    : null

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
      rawSmsSummary: null,
      detectedAccountLast4: curated.last4,
      newBalance: curated.balance,
      merchantNormalized: null,
    }
  } else if (staticResult) {
    parsed = staticResult
  } else {
    // Gemini path: API key required, rate-limited.
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      await service.from('sms_parse_log')
        .update({ status: 'failed', failure_code: 'not_configured', parse_method: 'ai' })
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
        .update({ status: 'failed', failure_code: 'rate_limited', parse_method: 'ai' })
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
        .update({ status: 'failed', failure_code: 'gemini_error', parse_method: 'ai' })
        .eq('id', logId)
      // 502 → WorkManager retries with a fresh request (new log row).
      return NextResponse.json({ ok: false, reason: 'ai_failed' }, { status: 502 })
    }

    // Learn a GLOBAL regex template for this sender after the response is sent.
    // after() keeps the serverless function alive — a bare void promise is
    // frozen the moment the response returns and never completes on Vercel.
    if (sender && parsed.confidence >= PATTERN_LEARN_CONFIDENCE && parsed.is_transaction) {
      const learnArgs = [message, sender, parsed, service, apiKey, userId] as const
      after(() => learnPattern(...learnArgs))
    }
  }

  // Which tier parsed this row — stamped for the admin audit loop.
  const parseMethod: 'curated' | 'template' | 'ai' =
    curated ? 'curated' : staticResult ? 'template' : 'ai'

  if (!parsed.is_transaction || !parsed.amount || !parsed.currency) {
    await service.from('sms_parse_log')
      .update({
        status: 'rejected',
        confidence: parsed.confidence ?? 0,
        // is_transaction but missing amount/currency → null_amount; otherwise not a transaction
        failure_code: parsed.is_transaction ? 'null_amount' : 'not_transaction',
        parse_method: parseMethod,
      })
      .eq('id', logId)
    return NextResponse.json({ ok: false, reason: 'not_transaction' })
  }

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

  const autoAdd = parsed.confidence >= CONFIRM_CONFIDENCE
  const isIncome = ['income', 'refund', 'instant_transfer_in'].includes(parsed.kind ?? '')
  // Prefer the transaction date embedded in the SMS body (curated patterns)
  // over the receive timestamp — they differ for delayed/offline deliveries.
  const day = txDay ?? nowIso.slice(0, 10)

  // Promote the log row with the full parse result.
  const { error: promoteErr } = await service
    .from('sms_parse_log')
    .update({
      parsed_ok: true,
      status: 'logged',
      failure_code: null,
      confidence: parsed.confidence,
      amount: parsed.amount,
      currency: parsed.currency,
      merchant: parsed.merchant,
      bank_name: parsed.bank_name,
      category: parsed.category,
      awaiting_confirmation: !autoAdd,
      account_last4: cleanLast4,
      kind: parsed.kind,
      clean_title: parsed.cleanTitle,
      raw_sms_summary: parsed.rawSmsSummary,
      new_balance: parsed.newBalance ?? null,
      merchant_normalized: parsed.merchantNormalized ?? null,
      parse_method: parseMethod,
      pattern_id: patternId,
      payment_instrument: paymentInstrument,
    })
    .eq('id', logId)

  if (promoteErr) {
    console.error('[sms/parse] log promote failed', promoteErr)
    return NextResponse.json({ ok: false, reason: 'log_insert_failed' }, { status: 500 })
  }

  // Auto-add expense or income.
  let expenseId: string | null = null
  let incomeId: string | null = null
  const bankPrefix = parsed.bank_name ? `${parsed.bank_name}: ` : ''
  // Clean one-sentence AI summary when available; raw SMS only as fallback.
  const autoNotes = parsed.rawSmsSummary
    ?? `[auto from ${source ?? 'sms'}] ${bankPrefix}${message.slice(0, 180)}`

  if (autoAdd && isIncome) {
    const sourceType = parsed.kind === 'refund' ? 'refund' : 'other'
    const { data: insertedIncome, error: incomeErr } = await service
      .from('income_sources')
      .insert({
        user_id: userId,
        name: parsed.cleanTitle ?? parsed.merchant ?? parsed.bank_name ?? 'Bank credit',
        amount: parsed.amount,
        currency: parsed.currency,
        is_recurring: false,
        source_type: sourceType,
        notes: autoNotes,
      })
      .select('id')
      .single()

    if (incomeErr) {
      console.error('[sms/parse] insert income failed', incomeErr)
    } else {
      incomeId = insertedIncome?.id ?? null
    }
  } else if (autoAdd) {
    const { data: pmRow } = await service
      .from('payment_methods')
      .select('id')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle()

    type ExpenseCategory = 'Rent' | 'Transport' | 'Food' | 'Enjoyment' | 'Savings' | 'Debt' | 'Remittance' | 'Other'
    const rawCat = (parsed.category ?? '').toLowerCase()
    const mappedCategory: ExpenseCategory =
      parsed.kind === 'atm_withdrawal' ? 'Other' :
      parsed.kind === 'instant_transfer_out' ? 'Remittance' :
      rawCat.includes('rent') || rawCat.includes('housing') ? 'Rent' :
      rawCat.includes('transport') || rawCat.includes('travel') || rawCat.includes('fuel') || rawCat.includes('uber') ? 'Transport' :
      rawCat.includes('food') || rawCat.includes('restaurant') || rawCat.includes('grocery') || rawCat.includes('dining') ? 'Food' :
      rawCat.includes('entertainment') || rawCat.includes('enjoyment') || rawCat.includes('leisure') ? 'Enjoyment' :
      rawCat.includes('saving') || rawCat.includes('investment') ? 'Savings' :
      rawCat.includes('debt') || rawCat.includes('loan') || rawCat.includes('instalment') ? 'Debt' :
      rawCat.includes('transfer') || rawCat.includes('remittance') || rawCat.includes('send') ? 'Remittance' :
      'Other'

    const { data: insertedExpense, error: expenseErr } = await service
      .from('expenses')
      .insert({
        user_id: userId,
        expense_date: day,
        description: parsed.cleanTitle ?? parsed.merchantNormalized ?? parsed.merchant ?? parsed.bank_name ?? 'Bank transaction',
        category: mappedCategory,
        amount: parsed.amount,
        currency: parsed.currency,
        payment_method_id: pmRow?.id ?? null,
        notes: autoNotes,
      })
      .select('id')
      .single()

    if (expenseErr) {
      console.error('[sms/parse] insert expense failed', expenseErr)
    } else {
      expenseId = insertedExpense?.id ?? null
    }
  }

  if (expenseId || incomeId) {
    await service.from('sms_parse_log')
      .update({ expense_id: expenseId, income_id: incomeId })
      .eq('id', logId)
  }

  // Push runs in after() so Vercel keeps the function alive until delivery,
  // and the result is logged — a missing FIREBASE_SERVICE_ACCOUNT_JSON or an
  // all-stale token list shows up in the logs instead of failing silently.
  const pushArgs: SendNativePushArgs =
    autoAdd && isIncome
      ? {
          userId,
          title: `+${parsed.currency} ${parsed.amount.toLocaleString()} — ${parsed.cleanTitle ?? 'Bank credit'}`,
          body: `Received via ${parsed.bank_name ?? 'bank'}. Tap to view.`,
          data: { kind: 'sms_income_added', incomeId: incomeId ?? '', logId },
          collapseKey: `sms-income-${hash.slice(0, 12)}`,
        }
      : autoAdd
        ? {
            userId,
            title: parsed.cleanTitle
              ? `${parsed.currency} ${parsed.amount.toLocaleString()} — ${parsed.cleanTitle}`
              : `${parsed.currency} ${parsed.amount.toLocaleString()} at ${parsed.merchant ?? 'merchant'}`,
            body: `Tracked by ${parsed.bank_name ?? 'your bank'}. Tap to view.`,
            data: { kind: 'sms_auto_added', expenseId: expenseId ?? '', logId },
            collapseKey: `sms-${hash.slice(0, 12)}`,
          }
        : {
            userId,
            title: `Confirm: ${parsed.cleanTitle ?? `${parsed.currency} ${parsed.amount.toLocaleString()}`}`,
            body: `${parsed.currency} ${parsed.amount.toLocaleString()} — tap to add.`,
            data: { kind: 'sms_confirm', hash, logId, amount: String(parsed.amount), currency: parsed.currency },
            collapseKey: `sms-confirm-${hash.slice(0, 12)}`,
          }

  // Record the push send result on the log row so delivery failures are visible
  // in admin instead of being silently console.log'd. status → 'notified' only
  // when at least one device actually accepted the push.
  after(async () => {
    try {
      const result = await sendNativePush(pushArgs)
      const delivered = result.ok && (result.sent ?? 0) > 0
      // Atomic: records push_result; if delivered → 'confirmed' when the app has
      // already acked, else 'notified'. A failed push leaves status untouched.
      await service.rpc('sms_mark_pushed', {
        p_log_id: logId,
        p_result: result,
        p_delivered: delivered,
      })
      if (!delivered) console.error('[sms/parse] push not delivered', result)
    } catch (e) {
      console.error('[sms/parse] push notification failed', e)
    }
  })

  // Record this user against the matched learned/promoted template for an
  // accurate distinct-user count (drives the promotion min_unique_users gate).
  if (matchedTemplateId && sender) {
    const tid = matchedTemplateId
    after(() => recordTemplateUser(tid, userId, service))
  }

  return NextResponse.json({
    ok: true,
    autoAdded: autoAdd,
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
    },
  }

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    rawSmsSummary: parsed.rawSmsSummary ?? null,
    detectedAccountLast4: parsed.detectedAccountLast4 ?? null,
    newBalance: typeof parsed.newBalance === 'number' ? parsed.newBalance : null,
    merchantNormalized: parsed.merchantNormalized ?? null,
  }
}
