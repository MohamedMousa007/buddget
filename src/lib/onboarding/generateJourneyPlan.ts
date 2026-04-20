/**
 * The single AI call in the entire Journey: takes a context built by
 * `buildAiPlanContext` and asks Gemini (via `regenerateBudgetPlanWithAi`)
 * to refine the preset seed into a personalised category set. Falls
 * back silently to the preset seed if the AI call fails for any reason
 * (rate limit, timeout, invalid shape, network).
 *
 * No other AI calls happen during the Journey — mid-flow Buddgy copy is
 * deterministic (see `buildBuddgyMessage`).
 */

import { regenerateBudgetPlanWithAi } from '@/lib/ai/generateBudgetPlan'
import type { BudgetCategoryRow } from '@/lib/budget/lifestyleMappings'
import type { JourneyPlanContext } from '@/lib/onboarding/buildAiPlanContext'
import { JOURNEY_EVENTS, track } from '@/lib/analytics/events'

export interface JourneyPlanResult {
  categories: BudgetCategoryRow[]
  /** Where the categories came from — UI can surface a subtle banner
   *  ("Smart default applied — ask Buddgy to regenerate anytime") when
   *  the AI call failed. */
  source: 'ai' | 'preset'
  /** Raw error string if the AI call failed, for debugging. Never
   *  surfaced to the user. */
  error?: string
}

export async function generateJourneyPlan(
  context: JourneyPlanContext,
): Promise<JourneyPlanResult> {
  track(JOURNEY_EVENTS.aiPlanCalled)
  const startedAt = Date.now()
  try {
    const refined = await regenerateBudgetPlanWithAi({
      categories: context.initialCategories,
      income: context.income,
      currency: context.currency,
      city: context.city,
      country: context.country,
      household: context.household,
      feedback: context.feedback,
    })
    if (!Array.isArray(refined) || refined.length === 0) {
      throw new Error('AI returned empty plan')
    }
    track(JOURNEY_EVENTS.completed, {
      durationMs: Date.now() - startedAt,
      source: 'ai',
    })
    return { categories: refined, source: 'ai' }
  } catch (err) {
    track(JOURNEY_EVENTS.aiPlanFailed, {
      reason: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
    })
    track(JOURNEY_EVENTS.fallbackPresetUsed)
    return {
      categories: context.initialCategories,
      source: 'preset',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
