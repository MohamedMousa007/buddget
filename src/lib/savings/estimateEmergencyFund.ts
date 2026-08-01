import { generateWithFallback, throwIfAiProxyNotOk } from '@/lib/ai/generateWithFallback'

/** AI-suggested emergency-fund sizing (monthly essentials + months of runway). */
export interface EmergencyEstimate {
  monthlyEssentials: number
  targetMonths: number
  rationale: string
}

/**
 * Ask the (Google-Search-grounded) model for a reasonable minimum monthly-essentials figure for
 * the user's country, sanity-checked against their own tracked spend when available. Grounding is
 * why this needs the `grounded` flag — the model pulls current local cost-of-living, like asking
 * it in chat. Returns a clamped, sane estimate; the user edits it afterwards.
 */
export async function estimateEmergencyFund(
  input: { currency: string; country?: string; trackedEssentials?: number },
  signal?: AbortSignal,
): Promise<EmergencyEstimate> {
  const where = input.country || `the country that primarily uses the ${input.currency} currency`
  const known = input.trackedEssentials && input.trackedEssentials > 0
    ? `The user's own tracked essentials are about ${Math.round(input.trackedEssentials)} ${input.currency}/month — sanity-check against that and local prices.`
    : `The user has no spending history yet, so base it on typical local costs for a modest household.`

  const prompt =
    `You are a personal-finance planner. Using current local cost-of-living data, estimate a reasonable ` +
    `MINIMUM monthly essentials budget (housing/rent, food, transport, utilities, basic health) for one ` +
    `modest household in ${where}. ${known} Also suggest an emergency-fund size in months (usually 3–6). ` +
    `Reply with ONLY a JSON object and no other text: ` +
    `{"monthlyEssentials": <number in ${input.currency}>, "targetMonths": <integer 3-6>, "rationale": "<one short sentence>"}.`

  const res = await generateWithFallback(
    { contents: [{ role: 'user', parts: [{ text: prompt }] }], grounded: true },
    { signal },
  )
  await throwIfAiProxyNotOk(res)

  const payload = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  return parseEmergencyEstimate(text)
}

/** Pull the JSON out of a (possibly grounded, prose-wrapped) model reply and clamp to sane values. */
export function parseEmergencyEstimate(text: string): EmergencyEstimate {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not read the estimate — please try again.')

  const parsed = JSON.parse(match[0]) as Partial<EmergencyEstimate>
  const essentials = Number(parsed.monthlyEssentials)
  if (!Number.isFinite(essentials) || essentials <= 0) throw new Error('The estimate looked off — please try again.')

  return {
    monthlyEssentials: Math.round(essentials),
    targetMonths: Math.min(6, Math.max(3, Math.round(Number(parsed.targetMonths) || 3))),
    rationale: String(parsed.rationale ?? ''),
  }
}
