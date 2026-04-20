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

  // ── Phase 1 — Identity ────────────────────────────────────────────
  {
    id: 'identity.intro',
    phase: 'identity',
    kind: 'info',
    titleKey: 'onboarding.journey.identity.intro.title',
    bodyKey: 'onboarding.journey.identity.intro.body',
  },
  {
    id: 'identity.name',
    phase: 'identity',
    kind: 'field',
    writeKey: 'identity.displayName',
    input: {
      type: 'text',
      placeholderKey: 'onboarding.journey.identity.name.placeholder',
      maxLength: 60,
    },
  },
  {
    id: 'identity.country',
    phase: 'identity',
    kind: 'field',
    writeKey: 'identity.country',
    hintKey: 'onboarding.journey.identity.country.hint',
    input: { type: 'country' },
  },
  {
    id: 'identity.city',
    phase: 'identity',
    kind: 'field',
    writeKey: 'identity.city',
    hintKey: 'onboarding.journey.identity.city.hint',
    optional: true,
    input: {
      type: 'text',
      placeholderKey: 'onboarding.journey.identity.city.placeholder',
      maxLength: 60,
    },
  },
  {
    id: 'identity.currency',
    phase: 'identity',
    kind: 'field',
    writeKey: 'identity.baseCurrency',
    hintKey: 'onboarding.journey.identity.currency.hint',
    input: { type: 'currency' },
  },
  {
    id: 'identity.household',
    phase: 'identity',
    kind: 'field',
    writeKey: 'identity.household',
    hintKey: 'onboarding.journey.identity.household.hint',
    input: {
      type: 'single-select',
      options: [
        {
          value: 'solo',
          labelKey: 'onboarding.journey.identity.household.soloLabel',
        },
        {
          value: 'couple',
          labelKey: 'onboarding.journey.identity.household.coupleLabel',
        },
        {
          value: 'family',
          labelKey: 'onboarding.journey.identity.household.familyLabel',
        },
      ],
    },
  },

  // ── Phase 3 — Money In (PMs first, then income) ─────────────────────
  // Phase 2 (AI describe) ships in PR2; phase 3 lives here now so the
  // money-in dependency graph (PM → income) is captured in this PR's
  // shippable surface.
  {
    id: 'money.pm.intro',
    phase: 'moneyIn',
    kind: 'info',
    titleKey: 'onboarding.journey.moneyIn.pmIntro.title',
    bodyKey: 'onboarding.journey.moneyIn.pmIntro.body',
  },
  {
    id: 'money.pm.list',
    phase: 'moneyIn',
    kind: 'multi',
    writeKey: 'moneyIn.paymentMethods',
    entity: 'paymentMethods',
    minEntries: 1,
    maxEntries: 20,
  },
  {
    id: 'money.income.list',
    phase: 'moneyIn',
    kind: 'multi',
    writeKey: 'moneyIn.incomeSources',
    entity: 'incomeSources',
    minEntries: 1,
    maxEntries: 20,
  },
]
