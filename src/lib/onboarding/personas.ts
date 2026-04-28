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

/** Onboarding stepper (3 cards): ties UI choice to `OnboardingDraft['budgetStyle']` + analytics persona id. */
export const ONBOARDING_BUDGET_STYLE_CARDS = [
  {
    budgetStyle: 'balanced' as const,
    personaId: 'steady_navigator' as const,
    emoji: '⚖️',
    title: 'Balanced',
    description: 'Cover needs, enjoy life, save a little.',
  },
  {
    budgetStyle: 'aggressive_saver' as const,
    personaId: 'goal_accelerator' as const,
    emoji: '🎯',
    title: 'Saving hard',
    description: 'Minimize spending, maximize savings.',
  },
  {
    budgetStyle: 'just_tracking' as const,
    personaId: 'flex_explorer' as const,
    emoji: '📊',
    title: 'Just tracking',
    description: 'No strict budget — I just want to see where my money goes.',
  },
] as const
