/** Fixed personas the model must choose from (IDs stable for UI copy). */
export const ONBOARDING_PERSONA_PRESETS = [
  {
    id: 'steady_navigator',
    label: 'Steady Navigator',
    tagline: 'You balance today’s bills with tomorrow’s peace of mind.',
  },
  {
    id: 'goal_accelerator',
    label: 'Goal Accelerator',
    tagline: 'Targets drive your spending — you like a clear finish line.',
  },
  {
    id: 'essentialist',
    label: 'Essentialist',
    tagline: 'Needs first, noise later — you keep the core solid.',
  },
  {
    id: 'social_spender',
    label: 'Social Spender',
    tagline: 'Life happens with people; you budget for experiences.',
  },
  {
    id: 'debt_sprinter',
    label: 'Debt Sprinter',
    tagline: 'You want liabilities shrinking as fast as safely possible.',
  },
  {
    id: 'future_investor',
    label: 'Future Investor',
    tagline: 'Long-term growth competes with short-term wants — on purpose.',
  },
  {
    id: 'family_anchor',
    label: 'Family Anchor',
    tagline: 'Household stability is the headline in your money story.',
  },
  {
    id: 'flex_explorer',
    label: 'Flex Explorer',
    tagline: 'Income or life shifts often — you want a plan that adapts.',
  },
] as const

export type OnboardingPersonaId = (typeof ONBOARDING_PERSONA_PRESETS)[number]['id']

export function personaPromptBlock(): string {
  return ONBOARDING_PERSONA_PRESETS.map((p) => `- ${p.id}: ${p.label} — ${p.tagline}`).join('\n')
}

export function isValidPersonaId(id: string): id is OnboardingPersonaId {
  return ONBOARDING_PERSONA_PRESETS.some((p) => p.id === id)
}
