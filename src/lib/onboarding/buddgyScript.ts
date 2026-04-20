/**
 * Buddgy's conversational script — **deterministic, not AI-driven**.
 *
 * Why this exists
 * ---------------
 * During onboarding, Buddgy needs to feel alive without firing an AI
 * call on every card (rate limits, latency, cost). The solution is
 * scripted templates with variable interpolation + per-card variants
 * picked from the user's prior answers. AI only runs **once** — at the
 * very end, to build the budget plan.
 *
 * API
 * ---
 *   const message = buildBuddgyMessage('identityCity', answers, t)
 *   // → "Which part of UAE, Amr?"  (when answers.country === 'UAE')
 *   // → "Which city, Amr?"          (default fallback)
 *
 * Templates live in the i18n dictionary at
 * `onboarding.journey.buddgy.<cardId>.<variant>`. Slot tokens (`{name}`,
 * `{country}`, `{currency}`, etc.) are resolved against the `answers`
 * object; missing slots are dropped silently (template should still
 * read naturally when a slot is absent).
 */

import type { Dictionary } from '@/lib/i18n/types'

/** The answer shape Buddgy can reference. Intentionally a subset of
 *  `JourneyAnswers` — only the fields that appear in templates. */
export interface BuddgyAnswers {
  name?: string
  country?: string
  city?: string
  baseCurrency?: string
  secondaryCurrency?: string | null
  household?: 'solo' | 'couple' | 'family'
  firstPaymentMethodName?: string
  incomeCurrency?: string
}

/** Union of every scripted card id. Adding a new card = extending this
 *  plus adding a matching entry to the i18n `buddgy` namespace and a
 *  variant resolver (if needed). TypeScript then prevents typos at
 *  call sites. */
export type BuddgyCardId =
  | 'welcomeIntro'
  | 'identityName'
  | 'identityCountry'
  | 'identityCity'
  | 'identityCurrency'
  | 'identitySecondaryCurrency'
  | 'identityHousehold'
  | 'moneyInPmIntro'
  | 'moneyInIncomeIntro'
  | 'gateSavings'
  | 'gateDebts'
  | 'gateSubscriptions'
  | 'goalsIntro'
  | 'generateIntro'

/**
 * Map of card id → pure function that picks a variant key from the
 * user's current answers. Defaults to `'default'` when no special
 * branch applies. Each variant must have a corresponding i18n entry.
 */
const VARIANT_PICKERS: Partial<Record<BuddgyCardId, (a: BuddgyAnswers) => string>> = {
  identityCity: (a) => {
    const country = a.country?.toLowerCase() ?? ''
    if (country.includes('emirates') || country === 'uae') return 'uae'
    if (country.includes('egypt')) return 'egypt'
    if (country.includes('saudi')) return 'saudi'
    if (country.includes('jordan')) return 'jordan'
    return 'default'
  },
  identitySecondaryCurrency: (a) => {
    // Users in GCC countries often send money to Egypt/India/home —
    // the template hints at this when the context applies.
    const country = a.country?.toLowerCase() ?? ''
    if (country.includes('emirates') || country.includes('saudi') || country.includes('qatar')) {
      return 'remittance'
    }
    return 'default'
  },
  moneyInIncomeIntro: (a) => (a.firstPaymentMethodName ? 'afterPm' : 'default'),
}

/** Pick the variant key the engine should use for a given card. Pure
 *  function — easy to unit-test. */
export function computeBuddgyVariant(
  cardId: BuddgyCardId,
  answers: BuddgyAnswers,
): string {
  const picker = VARIANT_PICKERS[cardId]
  return picker ? picker(answers) : 'default'
}

/**
 * Resolve the template for a card + variant from the Dictionary. Falls
 * back through variants:
 *   1. `buddgy[cardId][variant]`
 *   2. `buddgy[cardId]['default']`
 *   3. empty string (logged as a missing-copy warning in dev)
 */
function resolveTemplate(
  cardId: BuddgyCardId,
  variant: string,
  t: Dictionary,
): string {
  const cardScripts = (t.onboarding.journey.buddgy as unknown as Record<
    string,
    Record<string, string>
  >)[cardId]
  if (!cardScripts) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[buddgy] missing card "${cardId}" in i18n dictionary`)
    }
    return ''
  }
  return cardScripts[variant] ?? cardScripts.default ?? ''
}

/**
 * Replace `{slot}` tokens in `template` with values from `answers`.
 * Unresolved slots are stripped (leaves a clean sentence even when the
 * user hasn't answered that question yet). Trailing whitespace is
 * collapsed so a dropped slot doesn't leave double spaces.
 */
function interpolate(template: string, answers: BuddgyAnswers): string {
  const withValues = template.replace(/\{([a-zA-Z]+)\}/g, (match, key: string) => {
    const v = (answers as Record<string, unknown>)[key]
    if (v == null || v === '') return ''
    return String(v)
  })
  // Collapse runs of whitespace + trim stray punctuation that a dropped
  // slot might have left exposed (", ." → "." etc).
  return withValues.replace(/\s{2,}/g, ' ').replace(/\s([,.!?])/g, '$1').trim()
}

/** Compose the full pipeline: pick variant → resolve template →
 *  interpolate answers. Returns the final user-facing string. */
export function buildBuddgyMessage(
  cardId: BuddgyCardId,
  answers: BuddgyAnswers,
  t: Dictionary,
): string {
  const variant = computeBuddgyVariant(cardId, answers)
  const template = resolveTemplate(cardId, variant, t)
  return interpolate(template, answers)
}
