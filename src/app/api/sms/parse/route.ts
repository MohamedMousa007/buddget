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

/** failure_code values that allow a later request to take over the claim. */
const RETRYABLE_CODES = ['gemini_error', 'rate_limited', 'not_configured']
const STALE_PROCESSING_MS = 2 * 60 * 1000

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
// Static template bypass
// ---------------------------------------------------------------------------

async function tryStaticParse(
  message: string,
  sender: string,
  service: ReturnType<typeof createServiceRoleClient>,
  userId: string,
): Promise<ParsedTx | null> {
  const { data: templates } = await service
    .from('sms_tracking_templates_ai')
    .select('id, regex_pattern, mapping_rules, match_count')
    .eq('sender', sender)
    .eq('user_id', userId)
    .eq('ai_enabled', true)
    .order('match_count', { ascending: false })
    .limit(20)

  if (!templates?.length) return null

  for (const tpl of templates) {
    let re: RegExp
    try { re = new RegExp(tpl.regex_pattern) } catch { continue }

    const m = re.exec(message)
    if (!m) continue

    try {
      const rules = tpl.mapping_rules as MappingRules

      // Amount — required; skip template if extraction fails
      const rawAmt = m[rules.amount.group] ?? ''
      const amtStr = rules.amount.removeCommas ? rawAmt.replace(/,/g, '') : rawAmt
      const amount = parseFloat(amtStr)
      if (!amount || !Number.isFinite(amount)) continue

      // Currency (literal constant OR capture group)
      const cRules = rules.currency
      const currency = !cRules ? null
        : 'literal' in cRules ? cRules.literal
        : (m[cRules.group] ?? null)

      // Optional fields
      const merchant  = rules.merchant ? (m[rules.merchant.group] ?? null) : null
      const last4Raw  = rules.last4    ? (m[rules.last4.group]    ?? null) : null
      const cleanLast4 = last4Raw ? last4Raw.replace(/\D/g, '').slice(-4) || null : null
      const bankName  = rules.bank_name ? rules.bank_name.literal : null
      const kind      = rules.kind as ParsedTx['kind']

      // Construct a human-readable title so push notifications are meaningful
      const cleanTitle =
        kind === 'atm_withdrawal'       ? `ATM Withdrawal${bankName ? ` — ${bankName}` : ''}` :
        kind === 'instant_transfer_out' ? `Transfer${merchant ? ` to ${merchant}` : ''}` :
        kind === 'instant_transfer_in'  ? `Transfer${merchant ? ` from ${merchant}` : ''}` :
        merchant ?? bankName ?? null

      // Atomic counter via DB function — prevents read-then-write race conditions
      void service.rpc('increment_sms_template_match_count', { p_id: tpl.id })

      return {
        is_transaction: true, amount,
        currency: currency as ParsedTx['currency'],
        merchant, bank_name: bankName,
        category: null, confidence: 1.0, kind,
        cleanTitle, rawSmsSummary: null,
        detectedAccountLast4: cleanLast4,
        newBalance: null, merchantNormalized: null,
      }
    } catch { continue }  // malformed mapping_rules — try next template
  }
  return null
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
    // Cap at 10 templates per sender per user to prevent runaway growth
    const { count } = await service
      .from('sms_tracking_templates_ai')
      .select('*', { count: 'exact', head: true })
      .eq('sender', sender)
      .eq('user_id', userId)
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

    // UNIQUE INDEX on (user_id, sender, md5(regex_pattern)) silently ignores exact duplicates
    const { error: tplErr } = await service.from('sms_tracking_templates_ai').insert({
      user_id: userId,
      sender,
      regex_pattern: learned.regex_pattern,
      template_sample: message.slice(0, 500),
      mapping_rules: learned.mapping_rules as unknown as Record<string, unknown>,
      ai_enabled: true,
      match_count: 0,
    })
    if (tplErr && tplErr.code !== '23505') {
      console.warn('[sms/parse] template insert failed', tplErr)
    } else if (!tplErr) {
      console.log('[sms/parse] template learned', { sender, regex: learned.regex_pattern })
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

  const hash = computeSmsHash(message)
  const nowIso = receivedAt ?? new Date().toISOString()

  // ---- Atomic claim (before any parsing) ----------------------------------
  // The partial unique index on (user_id, sms_hash) WHERE is_duplicate=false
  // makes this insert the dedup gate: a concurrent dual-path request or a
  // WorkManager retry gets 23505 and returns early with zero Gemini cost.
  const { data: claimed, error: claimErr } = await service
    .from('sms_parse_log')
    .insert({
      user_id: userId,
      source: source ?? 'sms',
      sender: sender ?? null,
      raw_body: message,
      parsed_ok: false,
      failure_code: 'processing',
      sms_hash: hash,
      is_duplicate: false,
      parsed_at: new Date().toISOString(),
      received_at: nowIso,
    })
    .select('id')
    .single()

  let logId: string
  if (claimed) {
    logId = claimed.id
  } else if (claimErr?.code === '23505') {
    const { data: existing } = await service
      .from('sms_parse_log')
      .select('id, expense_id, income_id, failure_code, parsed_at')
      .eq('user_id', userId)
      .eq('sms_hash', hash)
      .eq('is_duplicate', false)
      .maybeSingle()

    // Retryable claims (Gemini outage, quota, crashed mid-parse) may be taken
    // over so the SMS isn't lost; settled claims end the retry chain with 200.
    const staleProcessing =
      existing?.failure_code === 'processing' &&
      Date.now() - new Date(existing.parsed_at ?? 0).getTime() > STALE_PROCESSING_MS
    const retryable =
      !!existing &&
      (RETRYABLE_CODES.includes(existing.failure_code ?? '') || staleProcessing)

    if (!existing || !retryable) {
      // Diagnostic row so support can see the skipped repost.
      // is_duplicate=true sidesteps the partial unique index.
      await service.from('sms_parse_log').insert({
        user_id: userId,
        source: source ?? 'sms',
        sender: sender ?? null,
        raw_body: message,
        parsed_ok: false,
        is_duplicate: true,
        failure_code: 'duplicate',
        sms_hash: hash,
        expense_id: existing?.expense_id ?? null,
        received_at: nowIso,
      })
      return NextResponse.json({
        ok: true,
        deduped: true,
        expenseId: existing?.expense_id ?? null,
      })
    }

    // Conditional update is the takeover lock (compare-and-swap on the exact
    // state we observed) — 0 rows means another request won.
    let takeoverQuery = service
      .from('sms_parse_log')
      .update({ failure_code: 'processing', parsed_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('failure_code', existing.failure_code)
    takeoverQuery = existing.parsed_at
      ? takeoverQuery.eq('parsed_at', existing.parsed_at)
      : takeoverQuery.is('parsed_at', null)
    const { data: takeover } = await takeoverQuery.select('id')
    if (!takeover?.length) {
      return NextResponse.json({ ok: true, deduped: true })
    }
    logId = existing.id
  } else {
    console.error('[sms/parse] claim insert failed', claimErr)
    return NextResponse.json({ ok: false, reason: 'log_insert_failed' }, { status: 500 })
  }

  try {
  // Attempt static template bypass — skips rate limit + Gemini entirely.
  let parsed: ParsedTx
  const staticResult = sender ? await tryStaticParse(message, sender, service, userId) : null

  if (staticResult) {
    parsed = staticResult
  } else {
    // Gemini path: API key required, rate-limited.
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      await service.from('sms_parse_log')
        .update({ failure_code: 'not_configured', parse_method: 'ai' })
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
        .update({ failure_code: 'rate_limited', parse_method: 'ai' })
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
        .update({ failure_code: 'gemini_error', parse_method: 'ai' })
        .eq('id', logId)
      // 502 → WorkManager retries; the retry takes over this claim (no new row,
      // one Gemini call per attempt).
      return NextResponse.json({ ok: false, reason: 'ai_failed' }, { status: 502 })
    }

    // Learn a regex pattern for this sender after the response is sent.
    // after() keeps the serverless function alive — a bare void promise is
    // frozen the moment the response returns and never completes on Vercel.
    if (sender && parsed.confidence >= PATTERN_LEARN_CONFIDENCE && parsed.is_transaction) {
      const learnArgs = [message, sender, parsed, service, apiKey, userId] as const
      after(() => learnPattern(...learnArgs))
    }
  }

  // Track which path was used — stamped on every sms_parse_log row for admin visibility.
  const parseMethod: 'static' | 'ai' = staticResult ? 'static' : 'ai'

  // --- Everything below is unchanged from before the bypass was added ---

  if (!parsed.is_transaction || !parsed.amount || !parsed.currency) {
    await service.from('sms_parse_log')
      .update({
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

  // Fuzzy 60s dedup — catches bank + IPN dual SMS announcing the same
  // transaction with different wording. Legitimate repeat transactions more
  // than 60s apart pass through (the old day-wide hash blocked them).
  const receivedMs = new Date(nowIso).getTime()
  const { data: twin } = await service
    .from('sms_parse_log')
    .select('id, expense_id, income_id')
    .eq('user_id', userId)
    .eq('parsed_ok', true)
    .eq('is_duplicate', false)
    .eq('amount', parsed.amount)
    .eq('currency', parsed.currency)
    .neq('id', logId)
    .gte('received_at', new Date(receivedMs - 60_000).toISOString())
    .lte('received_at', new Date(receivedMs + 60_000).toISOString())
    .limit(1)
    .maybeSingle()

  if (twin) {
    await service.from('sms_parse_log')
      .update({
        is_duplicate: true,
        failure_code: 'duplicate',
        confidence: parsed.confidence,
        amount: parsed.amount,
        currency: parsed.currency,
        merchant: parsed.merchant,
        bank_name: parsed.bank_name,
        category: parsed.category,
        kind: parsed.kind,
        clean_title: parsed.cleanTitle,
        expense_id: twin.expense_id,
        parse_method: parseMethod,
      })
      .eq('id', logId)
    return NextResponse.json({ ok: true, deduped: true, expenseId: twin.expense_id })
  }

  // Server-side security: strip non-digits and truncate to last 4 — never trust raw output.
  const cleanLast4 = (parsed.detectedAccountLast4 ?? '').replace(/\D/g, '').slice(-4) || null

  const autoAdd = parsed.confidence >= CONFIRM_CONFIDENCE
  const isIncome = ['income', 'refund', 'instant_transfer_in'].includes(parsed.kind ?? '')
  const day = nowIso.slice(0, 10)

  // Promote the claimed row with the full parse result.
  const { error: promoteErr } = await service
    .from('sms_parse_log')
    .update({
      parsed_ok: true,
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
          data: { kind: 'sms_income_added', incomeId: incomeId ?? '' },
          collapseKey: `sms-income-${hash.slice(0, 12)}`,
        }
      : autoAdd
        ? {
            userId,
            title: parsed.cleanTitle
              ? `${parsed.currency} ${parsed.amount.toLocaleString()} — ${parsed.cleanTitle}`
              : `${parsed.currency} ${parsed.amount.toLocaleString()} at ${parsed.merchant ?? 'merchant'}`,
            body: `Tracked by ${parsed.bank_name ?? 'your bank'}. Tap to view.`,
            data: { kind: 'sms_auto_added', expenseId: expenseId ?? '' },
            collapseKey: `sms-${hash.slice(0, 12)}`,
          }
        : {
            userId,
            title: `Confirm: ${parsed.cleanTitle ?? `${parsed.currency} ${parsed.amount.toLocaleString()}`}`,
            body: `${parsed.currency} ${parsed.amount.toLocaleString()} — tap to add.`,
            data: { kind: 'sms_confirm', hash, amount: String(parsed.amount), currency: parsed.currency },
            collapseKey: `sms-confirm-${hash.slice(0, 12)}`,
          }

  after(async () => {
    try {
      const result = await sendNativePush(pushArgs)
      if (result.ok) {
        console.log('[sms/parse] push result', result)
      } else {
        console.error('[sms/parse] push failed', result)
      }
    } catch (e) {
      console.error('[sms/parse] push notification failed', e)
    }
  })

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
        .update({ failure_code: 'parse_exception' })
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
