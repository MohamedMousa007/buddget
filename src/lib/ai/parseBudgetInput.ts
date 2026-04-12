import { generateWithFallback, throwIfAiProxyNotOk } from '@/lib/ai/generateWithFallback'

/** Structured data extracted from the user's free-text description. */
export interface ParsedBudgetInput {
  income: { amount: number | null; currency: string | null }
  city: string | null
  country: string | null
  household: 'solo' | 'couple' | 'family' | null
  rent: { amount: number | null; includesUtilities: boolean }
  transport: 'public' | 'car' | 'walk' | 'mixed' | null
  savingsGoal: 'maximum' | 'moderate' | 'some' | null
  lifestyleNotes: string | null
  missingFields: string[]
}

const SYSTEM_PROMPT = `You are a JSON parser for a budget app. Extract structured data from the user's free-text description.

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "income": { "amount": number|null, "currency": "AED"|"USD"|"EGP"|null },
  "city": string|null,
  "country": string|null,
  "household": "solo"|"couple"|"family"|null,
  "rent": { "amount": number|null, "includesUtilities": boolean },
  "transport": "public"|"car"|"walk"|"mixed"|null,
  "savingsGoal": "maximum"|"moderate"|"some"|null,
  "lifestyleNotes": string|null,
  "missingFields": ["income"|"city"|"household"]
}

Rules:
- Extract ONLY what the user explicitly stated
- Set null for anything not mentioned
- "missingFields" lists critical missing info (income is always required if not stated)
- "lifestyleNotes" captures qualitative clues like "save the most" or "enjoy life"
- If user mentions a currency, use it. Default to AED if city is in UAE.
- "household": "solo" for single person, "couple" for with partner/spouse, "family" for with children`

/**
 * Parse free-text user description into structured budget input.
 * Single lightweight AI call (~500 input tokens, ~200 output tokens).
 */
export async function parseBudgetInput(userText: string): Promise<ParsedBudgetInput> {
  const contents = [
    { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: '{"income":{"amount":null,"currency":null},"city":null,"country":null,"household":null,"rent":{"amount":null,"includesUtilities":false},"transport":null,"savingsGoal":null,"lifestyleNotes":null,"missingFields":["income"]}' }] },
    { role: 'user', parts: [{ text: userText }] },
  ]

  const response = await generateWithFallback({
    contents,
    generationConfig: { temperature: 0, maxOutputTokens: 512 },
  })
  await throwIfAiProxyNotOk(response)
  const result = await response.json()
  const text: string = result.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  let jsonStr = text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  }

  try {
    const parsed = JSON.parse(jsonStr) as ParsedBudgetInput
    if (!parsed.missingFields) parsed.missingFields = []
    if (parsed.income?.amount == null && !parsed.missingFields.includes('income')) {
      parsed.missingFields.push('income')
    }
    return parsed
  } catch {
    return {
      income: { amount: null, currency: null },
      city: null,
      country: null,
      household: null,
      rent: { amount: null, includesUtilities: false },
      transport: null,
      savingsGoal: null,
      lifestyleNotes: userText,
      missingFields: ['income'],
    }
  }
}
