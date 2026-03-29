import type { Dictionary } from '@/lib/i18n/types'

/** Stable persona ids for prompts, validation, and stored plan rows. */
export const ONBOARDING_PERSONA_IDS = [
  'steady_navigator',
  'goal_accelerator',
  'essentialist',
  'social_spender',
  'debt_sprinter',
  'future_investor',
  'family_anchor',
  'flex_explorer',
] as const

export type OnboardingPersonaId = (typeof ONBOARDING_PERSONA_IDS)[number]

export function getOnboardingPersonaPresets(t: Dictionary) {
  const o = t.onboarding
  return [
    {
      id: 'steady_navigator' as const,
      label: o.personaSteadyLabel,
      tagline: o.personaSteadyTagline,
    },
    {
      id: 'goal_accelerator' as const,
      label: o.personaGoalLabel,
      tagline: o.personaGoalTagline,
    },
    {
      id: 'essentialist' as const,
      label: o.personaEssentialistLabel,
      tagline: o.personaEssentialistTagline,
    },
    {
      id: 'social_spender' as const,
      label: o.personaSocialLabel,
      tagline: o.personaSocialTagline,
    },
    {
      id: 'debt_sprinter' as const,
      label: o.personaDebtLabel,
      tagline: o.personaDebtTagline,
    },
    {
      id: 'future_investor' as const,
      label: o.personaInvestorLabel,
      tagline: o.personaInvestorTagline,
    },
    {
      id: 'family_anchor' as const,
      label: o.personaFamilyLabel,
      tagline: o.personaFamilyTagline,
    },
    {
      id: 'flex_explorer' as const,
      label: o.personaFlexLabel,
      tagline: o.personaFlexTagline,
    },
  ]
}

export function personaPromptBlock(t: Dictionary): string {
  return getOnboardingPersonaPresets(t).map((p) => `- ${p.id}: ${p.label} — ${p.tagline}`).join('\n')
}

export function isValidPersonaId(id: string): id is OnboardingPersonaId {
  return (ONBOARDING_PERSONA_IDS as readonly string[]).includes(id)
}
