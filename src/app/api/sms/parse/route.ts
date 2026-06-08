/**
 * POST /api/sms/parse
 *
 * AI-driven parser used by the Capacitor Android SMS retriever and the
 * Notification Listener fallback (and any iOS Shortcut that prefers AI parsing
 * over the regex `/api/sms/ingest` route).
 *
 * Auth: bearer token from `sms_ingest_tokens` (same surface the existing
 * `/api/sms/ingest` route uses).
 *
 * Behaviour:
 *  - Rate-limited to 100 successful AI calls per user per UTC day.
 *  - Duplicates (same amount + merchant fragment + day) are short-circuited
 *    via `sms_hash`.
 *  - Confidence >= 0.8 → expense auto-added.
 *  - Confidence in [0.6, 0.8) → row stored with `awaiting_confirmation = true`
 *    and a push notification fires for one-tap confirm.
 *  - Confidence < 0.6 → ignored (logged but not stored as an expense).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { SMS_PARSER_SYSTEM_PROMPT } from '@/lib/sms/aiParserPrompt'
import { sendNativePush } from '@/lib/server/sendNativePush'

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const RATE_LIMIT_PER_DAY = 100
const AUTO_CONFIDENCE = 0.8
const CONFIRM_CONFIDENCE = 0.6

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
}

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

export async function POST(request: Request) {
  const { userId } = await resolveUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI is not configured. Admin needs to set GEMINI_API_KEY.' },
      { status: 503 },
    )
  }

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

  // Rate-limit (per UTC day).
  const { data: usage } = await service
    .from('sms_parse_today')
    .select('parsed_count_today')
    .eq('user_id', userId)
    .maybeSingle()

  if ((usage?.parsed_count_today ?? 0) >= RATE_LIMIT_PER_DAY) {
    return NextResponse.json(
      { error: 'Daily SMS parse quota reached', limit: RATE_LIMIT_PER_DAY },
      { status: 429 },
    )
  }

  // Call Gemini.
  let parsed: ParsedTx
  try {
    parsed = await callGemini(apiKey, message)
  } catch (e) {
    console.error('[sms/parse] gemini failed', e)
    await service.from('sms_parse_log').insert({
      user_id: userId,
      source: source ?? 'sms',
      sender: sender ?? null,
      raw_body: message,
      parsed_ok: false,
      received_at: receivedAt ?? new Date().toISOString(),
    })
    return NextResponse.json({ ok: false, reason: 'ai_failed' }, { status: 502 })
  }

  if (!parsed.is_transaction || !parsed.amount || !parsed.currency) {
    await service.from('sms_parse_log').insert({
      user_id: userId,
      source: source ?? 'sms',
      sender: sender ?? null,
      raw_body: message,
      parsed_ok: false,
      confidence: parsed.confidence ?? 0,
      received_at: receivedAt ?? new Date().toISOString(),
    })
    return NextResponse.json({ ok: false, reason: 'not_transaction' })
  }

  if (parsed.confidence < CONFIRM_CONFIDENCE) {
    await service.from('sms_parse_log').insert({
      user_id: userId,
      source: source ?? 'sms',
      sender: sender ?? null,
      raw_body: message,
      parsed_ok: false,
      confidence: parsed.confidence,
      amount: parsed.amount,
      currency: parsed.currency,
      merchant: parsed.merchant,
      bank_name: parsed.bank_name,
      category: parsed.category,
      received_at: receivedAt ?? new Date().toISOString(),
    })
    return NextResponse.json({ ok: false, reason: 'low_confidence', confidence: parsed.confidence })
  }

  // De-duplicate via stable hash (amount cents + merchant fragment + UTC day).
  const day = new Date(receivedAt ?? Date.now()).toISOString().slice(0, 10)
  const merchantFragment = (parsed.merchant ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16)
  const cents = Math.round(parsed.amount * 100)
  const hash = crypto.createHash('sha256').update(`${cents}:${merchantFragment}:${day}`).digest('hex')

  const { data: existing } = await service
    .from('sms_parse_log')
    .select('id, expense_id')
    .eq('user_id', userId)
    .eq('sms_hash', hash)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, deduped: true, expenseId: existing.expense_id })
  }

  // Server-side security: strip non-digits and truncate to last 4 — never trust raw Gemini output.
  const cleanLast4 = (parsed.detectedAccountLast4 ?? '').replace(/\D/g, '').slice(-4) || null

  const autoAdd = parsed.confidence >= AUTO_CONFIDENCE
  const isIncome = ['income', 'refund', 'instant_transfer_in'].includes(parsed.kind ?? '')

  // Claim the parse slot atomically — unique index prevents concurrent WorkManager + JS
  // calls from both creating an expense for the same SMS.
  const { data: logRow, error: logConflict } = await service
    .from('sms_parse_log')
    .insert({
      user_id: userId,
      source: source ?? 'sms',
      sender: sender ?? null,
      raw_body: message,
      parsed_ok: true,
      confidence: parsed.confidence,
      amount: parsed.amount,
      currency: parsed.currency,
      merchant: parsed.merchant,
      bank_name: parsed.bank_name,
      category: parsed.category,
      sms_hash: hash,
      is_duplicate: false,
      awaiting_confirmation: !autoAdd,
      account_last4: cleanLast4,
      received_at: receivedAt ?? new Date().toISOString(),
    })
    .select('id')
    .single()

  if (!logRow) {
    if (logConflict?.code === '23505') {
      return NextResponse.json({ ok: true, deduped: true, reason: 'hash_race' })
    }
    console.error('[sms/parse] log insert failed', logConflict)
    return NextResponse.json({ ok: false, reason: 'log_insert_failed' }, { status: 500 })
  }

  // High-confidence → auto-add expense or income.
  let expenseId: string | null = null
  let incomeId: string | null = null
  const bankPrefix = parsed.bank_name ? `${parsed.bank_name}: ` : ''
  const autoNotes = parsed.rawSmsSummary
    ? `${parsed.rawSmsSummary}\n[auto from ${source ?? 'sms'}] ${message.slice(0, 180)}`
    : `[auto from ${source ?? 'sms'}] ${bankPrefix}${message.slice(0, 180)}`

  if (autoAdd && isIncome) {
    // Credit / inward transfer → income_sources
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
    // Debit / purchase → expenses
    const { data: pmRow } = await service
      .from('payment_methods')
      .select('id')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle()

    // Map kind + free-text category to the expense_category enum.
    // Valid values: Rent, Transport, Food, Enjoyment, Savings, Debt, Remittance, Other
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
        description: parsed.cleanTitle ?? parsed.merchant ?? parsed.bank_name ?? 'Bank transaction',
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
      .eq('id', logRow.id)
  }

  if (autoAdd && isIncome) {
    void sendNativePush({
      userId,
      title: `+${parsed.currency} ${parsed.amount.toLocaleString()} — ${parsed.cleanTitle ?? 'Bank credit'}`,
      body: `Received via ${parsed.bank_name ?? 'bank'}. Tap to view.`,
      data: { kind: 'sms_income_added', incomeId: incomeId ?? '' },
      collapseKey: `sms-income-${hash.slice(0, 12)}`,
    }).catch((e: unknown) => console.error('[sms/parse] push notification failed', e))
  } else if (autoAdd) {
    void sendNativePush({
      userId,
      title: parsed.cleanTitle
        ? `${parsed.currency} ${parsed.amount.toLocaleString()} — ${parsed.cleanTitle}`
        : `${parsed.currency} ${parsed.amount.toLocaleString()} at ${parsed.merchant ?? 'merchant'}`,
      body: `Tracked by ${parsed.bank_name ?? 'your bank'}. Tap to view.`,
      data: { kind: 'sms_auto_added', expenseId: expenseId ?? '' },
      collapseKey: `sms-${hash.slice(0, 12)}`,
    }).catch((e: unknown) => console.error('[sms/parse] push notification failed', e))
  } else {
    void sendNativePush({
      userId,
      title: `Confirm: ${parsed.cleanTitle ?? `${parsed.currency} ${parsed.amount.toLocaleString()}`}`,
      body: `${parsed.currency} ${parsed.amount.toLocaleString()} — tap to add.`,
      data: { kind: 'sms_confirm', hash, amount: String(parsed.amount), currency: parsed.currency },
      collapseKey: `sms-confirm-${hash.slice(0, 12)}`,
    }).catch((e: unknown) => console.error('[sms/parse] push notification failed', e))
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
    parsed = JSON.parse(raw) as Partial<ParsedTx>
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
  }
}
