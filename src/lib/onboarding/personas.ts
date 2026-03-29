/** Fixed personas the model must choose from (IDs stable for UI copy). */
export const ONBOARDING_PERSONA_PRESETS = [
  {
    id: 'steady_navigator',
    label: 'Steady Navigator',
    tagline: "You keep today's bills and tomorrow's peace of mind in perfect balance.",
  },
  {
    id: 'goal_accelerator',
    label: 'Goal Accelerator',
    tagline: 'You love a clear finish line — targets drive your spending decisions.',
  },
  {
    id: 'essentialist',
    label: 'Essentialist',
    tagline: 'Needs first, wants later — you keep the essentials rock-solid.',
  },
  {
    id: 'social_spender',
    label: 'Social Spender',
    tagline: 'Life is better with people — you budget for the experiences that matter.',
  },
  {
    id: 'debt_sprinter',
    label: 'Debt Sprinter',
    tagline: 'You want those liabilities shrinking as fast as safely possible.',
  },
  {
    id: 'future_investor',
    label: 'Future Investor',
    tagline: 'Long-term growth is your priority — even when short-term wants call.',
  },
  {
    id: 'family_anchor',
    label: 'Family Anchor',
    tagline: "Your family's stability is the headline in your money story.",
  },
  {
    id: 'flex_explorer',
    label: 'Flex Explorer',
    tagline: 'Life shifts fast for you — you need a plan that adapts just as quickly.',
  },
] as const

export type OnboardingPersonaId = (typeof ONBOARDING_PERSONA_PRESETS)[number]['id']

export function personaPromptBlock(): string {
  return ONBOARDING_PERSONA_PRESETS.map((p) => `- ${p.id}: ${p.label} — ${p.tagline}`).join('\n')
}

export function isValidPersonaId(id: string): id is OnboardingPersonaId {
  return ONBOARDING_PERSONA_PRESETS.some((p) => p.id === id)
}
