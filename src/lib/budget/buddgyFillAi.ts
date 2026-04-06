import { z } from 'zod'
import { generateWithFallback, throwIfAiProxyNotOk } from '@/lib/ai/generateWithFallback'
import type { BuddgyFillContextPayload } from '@/lib/ai/buddgyFillPrompt'
import type { Currency } from '@/lib/store/types'

const rowSchema = z.object({
  name: z.string(),
  emoji: z.string(),
  amount: z.number(),
  currency: z.string(),
})

/**
 * Calls /api/ai with mode buddgy-fill; returns parsed category rows or [].
 */
export async function fetchBuddgyFillCategories(
  ctx: BuddgyFillContextPayload
): Promise<Array<{ name: string; emoji: string; amount: number; currency: Currency }>> {
  const userText = 'Generate the JSON array now.'
  const response = await generateWithFallback({
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: { temperature: 0.35, maxOutputTokens: 1024 },
    mode: 'buddgy-fill',
    buddgyFillContext: ctx,
  })
  await throwIfAiProxyNotOk(response)
  const result = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return []

  let jsonStr = text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  }

  try {
    const parsed = JSON.parse(jsonStr) as unknown
    if (!Array.isArray(parsed)) return []
    const out: Array<{ name: string; emoji: string; amount: number; currency: Currency }> = []
    for (const item of parsed) {
      const r = rowSchema.safeParse(item)
      if (r.success) {
        out.push({
          name: r.data.name.trim(),
          emoji: r.data.emoji,
          amount: r.data.amount,
          currency: r.data.currency as Currency,
        })
      }
    }
    return out
  } catch {
    return []
  }
}
