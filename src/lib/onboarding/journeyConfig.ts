/**
 * Ordered list of cards that make up the onboarding Journey.
 *
 * This file is additive — subsequent commits append phases (identity,
 * describe, moneyIn, moneyOut, future, generate). The runner reads the
 * array top-to-bottom, filtered by each card's optional `condition`.
 *
 * Keep cards declarative (id, phase, writeKey, hints). UI widgets live
 * in `components/features/onboarding/journey/cards/*` and are selected
 * by the card's `kind`.
 */

import type { JourneyCard } from '@/lib/onboarding/journeyTypes'

export const JOURNEY_CARDS: ReadonlyArray<JourneyCard> = [
  // ── Phase 0 — Welcome ─────────────────────────────────────────────
  {
    id: 'welcome.intro',
    phase: 'welcome',
    kind: 'info',
    titleKey: 'onboarding.journey.welcome.intro.title',
    bodyKey: 'onboarding.journey.welcome.intro.body',
  },
  {
    id: 'welcome.path-fork',
    phase: 'welcome',
    kind: 'field',
    writeKey: 'journeyMode',
    hintKey: 'onboarding.journey.welcome.fork.hint',
    input: {
      type: 'single-select',
      options: [
        {
          value: 'guided',
          labelKey: 'onboarding.journey.welcome.fork.guidedLabel',
          descriptionKey: 'onboarding.journey.welcome.fork.guidedDescription',
        },
        {
          value: 'quick',
          labelKey: 'onboarding.journey.welcome.fork.quickLabel',
          descriptionKey: 'onboarding.journey.welcome.fork.quickDescription',
        },
      ],
    },
  },
]
