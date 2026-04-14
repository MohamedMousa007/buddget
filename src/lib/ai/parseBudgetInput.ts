import { generateWithFallback, throwIfAiProxyNotOk } from '@/lib/ai/generateWithFallback'

/** Structured data extracted from the user's free-text description. */
export interface ParsedBudgetInput {
  income: { amount: number | null; currency: string | null }
  city: string | null
  country: string | null
  household: 'solo' | 'couple' | 'family' | null
  rent: { amount: number | null; includesUtilities: boolean | null }
  transport: 'public' | 'car' | 'walk' | 'mixed' | 'taxi' | null
  savingsGoal: 'maximum' | 'moderate' | 'some' | null
  lifestyleNotes: string | null
  missingFields: string[]
}

const SYSTEM_PROMPT = `You are a JSON extractor. Parse the user's text into structured budget data.

CRITICAL: Extract ALL information mentioned. The user said specific details — capture them.

Return ONLY valid JSON, no explanation:
{
  "income": { "amount": number|null, "currency": string|null },
  "city": string|null,
  "country": string|null,
  "household": "solo"|"couple"|"family"|null,
  "rent": { "amount": number|null, "includesUtilities": boolean|null },
  "transportMode": string|null,
  "savingsGoal": "maximum"|"moderate"|"some"|null,
  "lifestyleNotes": string|null,
  "missingFields": string[]
}

Use "transportMode" for how they commute: map to one of "public"|"car"|"walk"|"mixed" (lowercase). If unclear, null.

Examples:
Input: "I live in Dubai with my wife, earning 17000 AED, rent 5000 including utilities"
Output: {"income":{"amount":17000,"currency":"AED"},"city":"Dubai","country":"UAE","household":"couple","rent":{"amount":5000,"includesUtilities":true},"transportMode":null,"savingsGoal":null,"lifestyleNotes":null,"missingFields":[]}

Input: "Single in Abu Dhabi, 12k salary, studio 3500, want to save max"
Output: {"income":{"amount":12000,"currency":"AED"},"city":"Abu Dhabi","country":"UAE","household":"solo","rent":{"amount":3500,"includesUtilities":null},"transportMode":null,"savingsGoal":"maximum","lifestyleNotes":"want to save maximum","missingFields":[]}

Rules:
- If CONTEXT says the app already knows monthly income, keep that amount unless the user clearly overrides it in their message.
- Default currency to AED when the city is in the UAE and no currency was stated.
- "missingFields" should list critical gaps (e.g. ["income"] if income is still unknown after applying CONTEXT).
- "includesUtilities": true only if they say utilities are included; false if explicitly excluded; null if not said.`

function stripJsonFromMarkdown(text: string): string {
  let s = text.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/g, '').trim()
  }
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) s = s.slice(start, end + 1)
  return s
}

function normalizeTransport(raw: unknown): ParsedBudgetInput['transport'] {
  const t = String(raw ?? '')
    .toLowerCase()
    .trim()
  if (!t) return null
  if (t.includes('mix')) return 'mixed'
  if (t.includes('taxi') || t.includes('uber') || t.includes('careem')) return 'taxi'
  if (t.includes('metro') || t.includes('bus') || t.includes('public')) return 'public'
  if (t.includes('walk')) return 'walk'
  if (t.includes('car') || t.includes('drive')) return 'car'
  if (t === 'public' || t === 'car' || t === 'walk' || t === 'mixed' || t === 'taxi') return t
  return null
}

export interface ParseBudgetInputOptions {
  knownIncome?: { amount: number; currency: string }
  preamble?: string
}

/**
 * Parse free-text user description into structured budget input.
 */
export async function parseBudgetInput(
  userText: string,
  options?: ParseBudgetInputOptions
): Promise<ParsedBudgetInput> {
  const ctxParts: string[] = []
  if (options?.knownIncome && options.knownIncome.amount > 0) {
    ctxParts.push(
      `CONTEXT: The user's monthly income is already ${options.knownIncome.amount} ${options.knownIncome.currency} in the app. Use this as income unless they explicitly give a different amount.`
    )
  }
  if (options?.preamble?.trim()) {
    ctxParts.push(`CONTEXT:\n${options.preamble.trim()}`)
  }
  const userBlock =
    ctxParts.length > 0 ? `${ctxParts.join('\n\n')}\n\nUser message:\n${userText}` : userText

  const contents = [
    { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
    {
      role: 'model',
      parts: [
        {
          text: '{"income":{"amount":null,"currency":null},"city":null,"country":null,"household":null,"rent":{"amount":null,"includesUtilities":null},"transportMode":null,"savingsGoal":null,"lifestyleNotes":null,"missingFields":["income"]}',
        },
      ],
    },
    { role: 'user', parts: [{ text: userBlock }] },
  ]

  const response = await generateWithFallback({
    contents,
    generationConfig: { temperature: 0, maxOutputTokens: 768 },
  })
  await throwIfAiProxyNotOk(response)
  const result = await response.json()
  const text: string = result.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  if (process.env.NODE_ENV === 'development') {
    console.debug('[parseBudgetInput] raw model text:', text)
  }

  const jsonStr = stripJsonFromMarkdown(text)

  try {
    const raw = JSON.parse(jsonStr) as Record<string, unknown>
    const income = (raw.income as ParsedBudgetInput['income']) ?? { amount: null, currency: null }
    const rentRaw = (raw.rent as Record<string, unknown>) ?? {}
    const rentAmount =
      typeof rentRaw.amount === 'number' && Number.isFinite(rentRaw.amount) ? rentRaw.amount : null
    const rentUtil =
      rentRaw.includesUtilities === true ? true
      : rentRaw.includesUtilities === false ? false
      : null

    const transport =
      normalizeTransport(raw.transport) ?? normalizeTransport(raw.transportMode)

    const missingFields = Array.isArray(raw.missingFields)
      ? (raw.missingFields as string[]).filter((x) => typeof x === 'string')
      : []

    const parsed: ParsedBudgetInput = {
      income: {
        amount: typeof income.amount === 'number' && Number.isFinite(income.amount) ? income.amount : null,
        currency: typeof income.currency === 'string' ? income.currency : null,
      },
      city: typeof raw.city === 'string' ? raw.city : null,
      country: typeof raw.country === 'string' ? raw.country : null,
      household:
        raw.household === 'solo' || raw.household === 'couple' || raw.household === 'family' ?
          raw.household
        : null,
      rent: { amount: rentAmount, includesUtilities: rentUtil },
      transport,
      savingsGoal:
        raw.savingsGoal === 'maximum' || raw.savingsGoal === 'moderate' || raw.savingsGoal === 'some' ?
          raw.savingsGoal
        : null,
      lifestyleNotes: typeof raw.lifestyleNotes === 'string' ? raw.lifestyleNotes : null,
      missingFields,
    }

    if (!parsed.missingFields.includes('income') && parsed.income.amount == null) {
      parsed.missingFields.push('income')
    }
    return parsed
  } catch {
    return {
      income: { amount: null, currency: null },
      city: null,
      country: null,
      household: null,
      rent: { amount: null, includesUtilities: null },
      transport: null,
      savingsGoal: null,
      lifestyleNotes: userText,
      missingFields: ['income'],
    }
  }
}
