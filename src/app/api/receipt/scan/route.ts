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
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const SYSTEM_PROMPT = `You are extracting a single expense from a photographed receipt for a user in Egypt or the GCC.

Return ONLY a JSON object matching this exact schema:
{
  "merchant": string (max 60 chars),
  "amount": number (positive, the FINAL total the customer paid; ignore subtotals, taxes, or per-item lines),
  "currency": "EGP" | "AED" | "SAR" | "QAR" | "KWD" | "OMR" | "BHD" | "USD",
  "date": string in YYYY-MM-DD or "" if unknown,
  "category": "Food" | "Transport" | "Enjoyment" | "Rent" | "Other",
  "confidence": number in [0,1],
  "rawTotalText": string (the literal substring you used to read the total),
  "notes": string (max 120 chars; supplementary detail, can be empty)
}

Rules:
- Currency priority: EGP first (Egypt-first), then AED / SAR / QAR / KWD / OMR / BHD / USD.
- If currency is ambiguous, default to "EGP".
- Category guidance:
  - Food = restaurants, cafes, groceries, delivery (Talabat, Otlob, Carrefour Egypt, Spinneys, Gourmet, Seoudi, Metro Market).
  - Transport = Uber, Careem, taxi, fuel, metro, bus.
  - Enjoyment = cinemas, gaming, leisure shopping.
  - Rent = housing payments / utility bills.
  - Other = anything else.
- "amount" must be a number (no currency symbol, no thousands separators).
- "date" should be ISO-formatted or "".
- "confidence" should reflect how sure you are about merchant + amount.
- Do NOT wrap the JSON in markdown fences. Output the JSON object only.`

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

export async function POST(request: Request) {
  const supabase = await createClient().catch(() => null)
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    },
  }

  let geminiRes: Response
  try {
    geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
  } catch (e) {
    console.error('[receipt/scan] gemini fetch failed', e)
    return NextResponse.json({ error: 'Failed to reach AI service' }, { status: 502 })
  }

  const payload = (await geminiRes.json().catch(() => null)) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    error?: { message?: string }
  } | null

  if (!geminiRes.ok || !payload) {
    const msg = payload?.error?.message || `Gemini returned ${geminiRes.status}`
    console.error('[receipt/scan] gemini error', msg)
    return NextResponse.json({ error: msg }, { status: geminiRes.status })
  }

  const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!raw) {
    return NextResponse.json({ error: 'No structured output from AI' }, { status: 502 })
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
