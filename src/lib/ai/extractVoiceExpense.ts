import { generateWithFallback, throwIfAiProxyNotOk } from '@/lib/ai/generateWithFallback'
import type { Currency, ExpenseCategory } from '@/lib/store/types'

export interface ExtractedExpense {
  amount: number
  currency: Currency
  description: string
  category: ExpenseCategory
  /** Confidence in [0,1] from the LLM. */
  confidence: number
}

const SUPPORTED_CURRENCIES: Currency[] = [
  'EGP',
  'AED',
  'SAR',
  'QAR',
  'KWD',
  'OMR',
  'BHD',
  'USD',
  'EUR',
  'GBP',
]

const SUPPORTED_CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Transport',
  'Enjoyment',
  'Rent',
  'Other',
]

/**
 * Extracts a structured expense from a free-form voice transcript using the
 * existing `/api/ai` (Gemini) proxy. Egypt-first vocabulary; gracefully falls
 * back to `EGP` when no currency is mentioned.
 */
export async function extractVoiceExpense(
  transcript: string,
  defaultCurrency: Currency,
): Promise<ExtractedExpense> {
  const text = transcript.trim()
  if (!text) {
    throw new Error('Empty transcript')
  }

  const prompt = `You are a budgeting assistant for users in Egypt and the Gulf.
Extract a single expense from this voice transcript:
"""
${text}
"""

Rules:
- "amount" must be a positive number.
- "currency" is one of: ${SUPPORTED_CURRENCIES.join(', ')}.
  - Default to "${defaultCurrency}" when no currency is mentioned.
  - Recognise جنيه / EGP first (Egypt-first), then AED / SAR / QAR / KWD / OMR / BHD / USD.
- "description" is a short merchant or item label (max 50 chars). Examples: "Talabat", "Carrefour Egypt", "Uber to office", "Costa Coffee", "Spinneys groceries".
- "category" is one of: ${SUPPORTED_CATEGORIES.join(', ')}.
  - Food = restaurants, groceries, delivery (Talabat / Otlob / Carrefour / Spinneys).
  - Transport = Uber, Careem, taxi, fuel, metro, bus.
  - Enjoyment = cafes, cinema, gaming, shopping for fun.
  - Rent = housing, utilities, internet bill.
  - Other = anything else.
- "confidence" is between 0 and 1. Set to 0.4 or lower if amount or merchant is ambiguous.

Return ONLY a JSON object with this exact shape:
{"amount": number, "currency": string, "description": string, "category": string, "confidence": number}`

  const response = await generateWithFallback({
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
    },
  })

  await throwIfAiProxyNotOk(response)
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!raw) throw new Error('No response from AI')

  let parsed: Partial<ExtractedExpense> & { currency?: string; category?: string }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('AI returned invalid JSON')
  }

  const amount = typeof parsed.amount === 'number' ? parsed.amount : Number(parsed.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Could not detect an amount')

  const currency = (SUPPORTED_CURRENCIES as string[]).includes(parsed.currency ?? '')
    ? (parsed.currency as Currency)
    : defaultCurrency

  const category = (SUPPORTED_CATEGORIES as string[]).includes(parsed.category ?? '')
    ? (parsed.category as ExpenseCategory)
    : 'Other'

  const description = (parsed.description ?? '').toString().trim().slice(0, 80) || 'Voice expense'
  const confidenceRaw = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
  const confidence = Math.max(0, Math.min(1, confidenceRaw))

  return { amount, currency, description, category, confidence }
}
