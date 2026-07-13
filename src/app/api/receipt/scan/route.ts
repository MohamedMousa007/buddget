/**
 * POST /api/receipt/scan
 *
 * Accepts a receipt image (multipart/form-data, field `image`) and returns
 * structured expense fields parsed via Gemini 2.5 Flash vision.
 *
 * Egypt-first: default currency `EGP` unless the receipt clearly says
 * otherwise; recognises EGP, AED, SAR, QAR, KWD, OMR, BHD, USD. Categories
 * match the existing `ExpenseCategory` union (Food | Transport | Enjoyment |
 * Rent | Other).
 *
 * Auth: Supabase session required.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { resolveRouteUser } from '@/lib/supabase/resolveRouteUser'

// Gemini thinking + a long itemized output + one retry can exceed Vercel's
// short default function duration — sibling AI routes all set this too.
export const maxDuration = 60

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const SYSTEM_PROMPT = `You extract an itemized expense from photos of a receipt for a user in Egypt or the GCC.
If multiple images are provided, they are CONSECUTIVE sections of the SAME receipt — stitch them into ONE result. Do not duplicate a line that spans a page break, and do not treat the images as separate receipts.

"isReceipt" is false when the image is NOT a purchase receipt/invoice/bill (person, landscape, screenshot, menu, random object). When false, set merchant "", amount 0, empty arrays, confidence 0.

Priorities, in this order — get these right above all else:
1. ITEMS — capture EVERY printed line item, in printed order, with its printed LINE TOTAL in "price" (unit price × qty, exactly as printed). A line you cannot fully read still MUST appear: unreadable name → use "غير معروف" on Arabic receipts or "Unknown" otherwise, with its printed price; unreadable price → the real name with price 0. Never skip a line because part of it is unreadable. If the name has a quantity marker ("2x", "x2", "2 ×"), move it to "qty" and remove it from "name". Exclude tax/service/tip/discount from items.
2. TOTAL — "amount" is the final printed grand total the customer paid. If NO grand total is printed, COMPUTE it: sum the item line totals, add any tax/service charged ON TOP, subtract discounts.
3. TAX — "taxIncluded" is true if VAT/tax is already baked into the item prices (sum of items ≈ total), false if it is added on top (sum of items + tax ≈ total). Put every non-item line in "charges": VAT/tax, service, tip, delivery, and discounts (discounts as NEGATIVE amounts).

Arabic fidelity: item names and merchants are often printed in Arabic. Transcribe Arabic text EXACTLY as printed, in Arabic script — never transliterate to Latin letters, never translate to English.

Self-check before answering: items plus charges must reconcile with the printed total (respecting taxIncluded). If they fall short, re-examine the images for lines you missed.

Never fail the whole read because a field is missing. If merchant or date is unclear, return "" — items and total matter most. Never invent lines that are not printed.

Category (one for the whole receipt): Food (restaurants, cafes, groceries, delivery — Talabat, Carrefour, Spinneys, Gourmet, Seoudi), Transport (Uber, Careem, fuel, metro), Enjoyment (cinema, gaming, leisure), Rent (housing, utilities), Other.
Currency: Egypt-first (EGP) unless clearly otherwise. All numbers plain (no symbols or thousands separators). "date" is YYYY-MM-DD or "".`

/** OpenAPI-subset schema enforced by the API — the model cannot omit fields or drift from enums. */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isReceipt: { type: 'BOOLEAN' },
    merchant: { type: 'STRING' },
    amount: { type: 'NUMBER' },
    currency: { type: 'STRING', enum: ['EGP', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD', 'USD'] },
    date: { type: 'STRING' },
    category: { type: 'STRING', enum: ['Food', 'Transport', 'Enjoyment', 'Rent', 'Other'] },
    taxIncluded: { type: 'BOOLEAN' },
    confidence: { type: 'NUMBER' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          price: { type: 'NUMBER' },
          qty: { type: 'NUMBER' },
        },
        required: ['name', 'price'],
        propertyOrdering: ['name', 'price', 'qty'],
      },
    },
    charges: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['tax', 'service', 'tip', 'discount', 'other'] },
          label: { type: 'STRING' },
          amount: { type: 'NUMBER' },
        },
        required: ['type', 'label', 'amount'],
        propertyOrdering: ['type', 'label', 'amount'],
      },
    },
    notes: { type: 'STRING' },
  },
  required: ['isReceipt', 'merchant', 'amount', 'currency', 'date', 'category', 'taxIncluded', 'confidence', 'items', 'charges', 'notes'],
  propertyOrdering: ['isReceipt', 'merchant', 'amount', 'currency', 'date', 'category', 'taxIncluded', 'confidence', 'items', 'charges', 'notes'],
} as const

const MAX_ATTEMPTS = 3

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class GeminiError extends Error {
  constructor(message: string, readonly status: number, readonly retryable: boolean) {
    super(message)
  }
}

/**
 * Calls Gemini with bounded retries + exponential backoff on transient failures
 * (429, 5xx, network errors, empty/blocked candidates). Returns the raw model text.
 */
async function callGeminiText(apiKey: string, requestBody: unknown): Promise<string> {
  let lastErr: GeminiError | null = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(400 * 2 ** (attempt - 1)) // 400ms, 800ms

    let res: Response
    try {
      res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
    } catch {
      lastErr = new GeminiError('Failed to reach AI service', 502, true)
      continue
    }

    const payload = (await res.json().catch(() => null)) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number }
      error?: { message?: string }
    } | null

    if (!res.ok || !payload) {
      const msg = payload?.error?.message || `Gemini returned ${res.status}`
      const retryable = res.status === 429 || res.status >= 500
      lastErr = new GeminiError(msg, res.status, retryable)
      if (retryable) continue
      throw lastErr
    }

    const candidate = payload.candidates?.[0]
    const finishReason = candidate?.finishReason
    const raw = candidate?.content?.parts?.map((p) => p.text ?? '').join('').trim()

    // Log token usage (incl. thinking tokens) so truncation vs thinking-token
    // consumption is diagnosable from real scans instead of guessed at.
    if (payload.usageMetadata) {
      console.log('[receipt/scan] usage', JSON.stringify(payload.usageMetadata), 'finish', finishReason ?? 'none')
    }

    // Output hit the token ceiling → the JSON is truncated and unparseable.
    // Retrying with the same budget won't help; fail with an actionable message.
    if (finishReason === 'MAX_TOKENS') {
      throw new GeminiError('This receipt was too long to read in one pass. Try splitting it into fewer, clearer photos.', 422, false)
    }
    if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'PROHIBITED_CONTENT') {
      throw new GeminiError("We couldn't process this image. Please try a clearer photo of the receipt.", 422, false)
    }
    if (!raw) {
      // Empty candidate (transient block / no content) — retry, then surface.
      lastErr = new GeminiError('No structured output from AI', 502, true)
      continue
    }
    return raw
  }
  throw lastErr ?? new GeminiError('AI service unavailable', 502, true)
}

function extractJson(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  const { user } = await resolveRouteUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI is not configured. Admin needs to set GEMINI_API_KEY.' },
      { status: 503 },
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const images = form.getAll('image').filter((f): f is File => f instanceof File)
  if (images.length === 0) {
    return NextResponse.json({ error: 'Missing image' }, { status: 400 })
  }
  if (images.length > 5) {
    return NextResponse.json({ error: 'Too many images (max 5)' }, { status: 400 })
  }

  let totalSize = 0
  const imageParts: { inlineData: { mimeType: string; data: string } }[] = []
  for (const img of images) {
    totalSize += img.size
    const buf = await img.arrayBuffer()
    imageParts.push({ inlineData: { mimeType: img.type || 'image/jpeg', data: Buffer.from(buf).toString('base64') } })
  }
  if (totalSize > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Images exceed 10 MB total' }, { status: 413 })
  }

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: SYSTEM_PROMPT },
          ...imageParts,
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      // Root cause of the "trouble reading" failures: 2.5-flash "thinking" tokens
      // share the output budget, so a low ceiling let thinking starve the JSON →
      // truncated → parse failure (even on short receipts). Give the answer ample
      // room (8192) and cap thinking (2048) so it stays for accuracy but can never
      // consume the whole budget. Both are ceilings — billing is on tokens actually
      // produced, so this doesn't raise cost on normal receipts.
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingBudget: 2048 },
      responseSchema: RESPONSE_SCHEMA,
    },
  }

  const startedAt = Date.now()
  let raw: string
  try {
    raw = await callGeminiText(apiKey, requestBody)
    console.log(`[receipt/scan] elapsed ${Date.now() - startedAt}ms images ${images.length}`)
  } catch (e) {
    const err = e instanceof GeminiError ? e : new GeminiError('AI service error', 502, false)
    console.error('[receipt/scan] gemini error', err.message)
    return NextResponse.json({ error: err.message }, { status: err.status })
  }

  let parsed: Record<string, unknown>
  try {
    const jsonStr = extractJson(raw)
    if (!jsonStr) throw new SyntaxError('no JSON object found')
    parsed = JSON.parse(jsonStr) as Record<string, unknown>
  } catch {
    console.error('[receipt/scan] failed to parse Gemini response', raw)
    return NextResponse.json(
      { error: 'AI returned unreadable response', details: 'Failed to parse receipt structure' },
      { status: 422 },
    )
  }

  return NextResponse.json({
    receipt: parsed,
    model: GEMINI_MODEL,
  })
}
