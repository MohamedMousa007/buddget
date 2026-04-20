/**
 * The full conversational onboarding sequence (flow v3).
 *
 * Topological ordering per the master plan (§5):
 *   0. Welcome → 1. Identity → 3. Money In (PMs then Income) →
 *   4. Money Out (Debts / Subs via gates) →
 *   5. Future (Savings via gate / Goals — mandatory) →
 *   6. Generate (SP5 wires the AI call)
 *
 * Phase 2 (AI describe) is deliberately absent — the user's decision
 * was "zero AI calls during cards; AI only runs once at the end for
 * plan generation." Buddgy's variable-interpolation script (SP3) handles
 * the "feels alive" goal without any AI calls mid-flow.
 *
 * Each `modal` card reuses the real app modal via `OnboardingModalGate`.
 * `gate` cards set a yes/no answer that the next card's `condition`
 * predicate reads.
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
        { value: 'solo', labelKey: 'onboarding.journey.identity.household.soloLabel' },
        { value: 'couple', labelKey: 'onboarding.journey.identity.household.coupleLabel' },
        { value: 'family', labelKey: 'onboarding.journey.identity.household.familyLabel' },
      ],
    },
  },

  // ── Phase 3 — Money In (PMs, then Income) ────────────────────────
  {
    id: 'money.pm.intro',
    phase: 'moneyIn',
    kind: 'info',
    titleKey: 'onboarding.journey.moneyIn.pmIntro.title',
    bodyKey: 'onboarding.journey.moneyIn.pmIntro.body',
  },
  {
    id: 'money.pm.modal',
    phase: 'moneyIn',
    kind: 'modal',
    entity: 'paymentMethods',
    minEntries: 1,
    maxEntries: 20,
    tutorialTourId: 'addPmTour',
    buddgyKey: 'moneyInPmIntro',
  },
  {
    id: 'money.income.modal',
    phase: 'moneyIn',
    kind: 'modal',
    entity: 'incomeSources',
    minEntries: 1,
    maxEntries: 20,
    tutorialTourId: 'addIncomeTour',
    buddgyKey: 'moneyInIncomeIntro',
  },

  // ── Phase 4 — Money Out (optional via gates) ─────────────────────
  {
    id: 'out.debts.gate',
    phase: 'moneyOut',
    kind: 'gate',
    writeKey: 'moneyOut.hasDebts',
    buddgyKey: 'gateDebts',
  },
  {
    id: 'out.debts.modal',
    phase: 'moneyOut',
    kind: 'modal',
    entity: 'debts',
    minEntries: 0,
    maxEntries: 20,
    condition: (a) => a.moneyOut.hasDebts === 'yes',
  },
  {
    id: 'out.subs.gate',
    phase: 'moneyOut',
    kind: 'gate',
    writeKey: 'moneyOut.hasSubscriptions',
    buddgyKey: 'gateSubscriptions',
  },
  {
    id: 'out.subs.modal',
    phase: 'moneyOut',
    kind: 'modal',
    entity: 'subscriptions',
    minEntries: 0,
    maxEntries: 20,
    condition: (a) => a.moneyOut.hasSubscriptions === 'yes',
  },

  // ── Phase 5 — Future (savings optional, goals mandatory) ─────────
  {
    id: 'future.savings.gate',
    phase: 'future',
    kind: 'gate',
    writeKey: 'future.hasSavings',
    buddgyKey: 'gateSavings',
  },
  {
    id: 'future.savings.modal',
    phase: 'future',
    kind: 'modal',
    entity: 'savingsAccounts',
    minEntries: 0,
    maxEntries: 20,
    condition: (a) => a.future.hasSavings === 'yes',
  },
  {
    id: 'future.goals.modal',
    phase: 'future',
    kind: 'modal',
    entity: 'goals',
    minEntries: 1, // mandatory per master plan
    maxEntries: 20,
    buddgyKey: 'goalsIntro',
  },

  // ── Phase 6 — Generate (SP5 implements the AI call here) ─────────
  {
    id: 'generate.loading',
    phase: 'generate',
    kind: 'loading',
    buddgyKey: 'generateIntro',
  },
]
