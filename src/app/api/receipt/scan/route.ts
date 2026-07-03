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

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const SYSTEM_PROMPT = `You are extracting an itemized expense from a photographed receipt for a user in Egypt or the GCC.

Return ONLY a JSON object matching this exact schema:
{
  "merchant": string (max 60 chars),
  "amount": number (positive, the FINAL printed grand total the customer paid),
  "currency": "EGP" | "AED" | "SAR" | "QAR" | "KWD" | "OMR" | "BHD" | "USD",
  "date": string in YYYY-MM-DD or "" if unknown,
  "category": "Food" | "Transport" | "Enjoyment" | "Rent" | "Other",
  "confidence": number in [0,1],
  "items": [ { "name": string (max 60 chars), "price": number, "qty": number (optional) } ],
  "charges": [ { "type": "tax" | "service" | "tip" | "discount" | "other", "label": string (max 40 chars), "amount": number } ],
  "notes": string (max 120 chars; supplementary detail, can be empty)
}

Rules:
- "amount" is the FINAL printed grand total (what the customer actually paid). Read it directly; do NOT sum the items yourself.
- "items" are the purchased line items only — each with its own printed price. "price" is the LINE TOTAL for that line (unit price × quantity), exactly as printed. Set "qty" when the receipt shows a quantity. If the item name contains a quantity marker like "2x", "x2" or "2 ×", set "qty" to that number and REMOVE the marker from "name". Exclude taxes, service, tips, and discounts from items.
- "charges" hold every non-item line that affects the total: VAT/tax, service charge, tip/gratuity, delivery, and discounts (use a NEGATIVE amount for discounts). Use type "other" if none fit.
- There is ONE category for the WHOLE receipt — do NOT categorise individual items (saves tokens).
- If items or charges are not legible, return them as empty arrays []. Never invent lines.
- Currency priority: EGP first (Egypt-first), then AED / SAR / QAR / KWD / OMR / BHD / USD. If ambiguous, default to "EGP".
- Category guidance:
  - Food = restaurants, cafes, groceries, delivery (Talabat, Otlob, Carrefour Egypt, Spinneys, Gourmet, Seoudi, Metro Market).
  - Transport = Uber, Careem, taxi, fuel, metro, bus.
  - Enjoyment = cinemas, gaming, leisure shopping.
  - Rent = housing payments / utility bills.
  - Other = anything else.
- All numbers must be plain numbers (no currency symbol, no thousands separators).
- "date" should be ISO-formatted or "".
- "confidence" should reflect how sure you are about merchant + total.
- Do NOT wrap the JSON in markdown fences. Output the JSON object only.`

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
    const raw = candidate?.content?.parts?.[0]?.text?.trim()
    if (!raw) {
      // Empty text or MAX_TOKENS/safety truncation — retry, then surface as unreadable.
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

  const image = form.get('image')
  if (!(image instanceof Blob)) {
    return NextResponse.json({ error: 'Missing image' }, { status: 400 })
  }
  if (image.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image exceeds 10 MB' }, { status: 413 })
  }

  const buf = await image.arrayBuffer()
  const base64 = Buffer.from(buf).toString('base64')
  const mimeType = image.type || 'image/jpeg'

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: SYSTEM_PROMPT },
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      maxOutputTokens: 2048,
    },
  }

  let raw: string
  try {
    raw = await callGeminiText(apiKey, requestBody)
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
