/**
 * Types for the AI-driven onboarding Journey (flow v3).
 *
 * A Journey is a linear sequence of typed cards. Each card reads/writes a
 * slot in `JourneyAnswers` — there is no untyped `Record<string, unknown>`
 * stash. Cards can be conditional (hidden when `condition(answers)` is
 * false) and can pre-fill their initial value from earlier answers + the
 * optional `aiSeed` captured at the describe step.
 *
 * This file is pure data — no React, no store imports. Runner + card
 * components import from here to stay decoupled from the UI.
 */

import type {
  Currency,
  Debt,
  DebtRecurringFrequency,
  IncomeSource,
  PaymentMethod,
  SavingsAccount,
  Subscription,
  GoalCategory,
} from '@/lib/store/types'
import type { ParsedBudgetInput } from '@/lib/ai/parseBudgetInput'

/** Top-level phase grouping (ordered). Drives the progress bar. */
export const JOURNEY_PHASES = [
  'welcome',
  'identity',
  'describe',
  'moneyIn',
  'moneyOut',
  'future',
  'generate',
] as const
export type JourneyPhase = (typeof JOURNEY_PHASES)[number]

/** Base fields shared by every card. */
interface BaseCard {
  id: string
  phase: JourneyPhase
  /** When present, card is hidden if this returns false. Used for Quick/Guided
   *  branching and for gate cards like "do you have debts?". */
  condition?: (answers: JourneyAnswers) => boolean
}

export interface InfoCard extends BaseCard {
  kind: 'info'
  /** i18n key for the title; body is optional. */
  titleKey: string
  bodyKey?: string
}

export interface FieldCard<TValue = unknown> extends BaseCard {
  kind: 'field'
  /** Slot in JourneyAnswers this card owns, expressed as a dotted path
   *  interpreted by the runner (e.g. `identity.displayName`). */
  writeKey: JourneyAnswerPath
  /** Widget the FieldCard renders. Each variant corresponds to a tiny
   *  component under `components/features/onboarding/journey/fields/`. */
  input:
    | { type: 'text'; placeholderKey?: string; maxLength?: number }
    | { type: 'country' }
    | { type: 'currency' }
    | {
        type: 'single-select'
        options: Array<{ value: string; labelKey: string; descriptionKey?: string }>
      }
    | { type: 'yes-no' }
  /** Optional explain line under the label. */
  hintKey?: string
  /** Allow skip? Default true for non-required slots. */
  optional?: boolean
  /** Prefill hook; runner calls this when mounting the card if the slot is
   *  currently empty. */
  prefill?: (answers: JourneyAnswers) => TValue | undefined
}

export interface MultiCard extends BaseCard {
  kind: 'multi'
  writeKey: JourneyAnswerPath
  /** Which entity the entries represent; runner routes to the right row editor. */
  entity: 'paymentMethods' | 'incomeSources' | 'debts' | 'subscriptions' | 'savingsAccounts' | 'goals'
  /** Minimum number of entries required to advance. 0 = can be empty. */
  minEntries: number
  /** Upper bound on row count, defensive (default 20). */
  maxEntries?: number
  prefill?: (answers: JourneyAnswers) => unknown[] | undefined
}

/** Cards that talk to Gemini. Rate-limit-aware; runner enforces a useRef
 *  lock so React double-invoke can't double-fire. */
export interface AiCard extends BaseCard {
  kind: 'ai'
  /** Which AI call this card makes. */
  call: 'parseDescribe' | 'generatePlan'
  writeKey: JourneyAnswerPath
}

export interface ReviewCard extends BaseCard {
  kind: 'review'
}

export interface TerminalCard extends BaseCard {
  kind: 'terminal'
}

export type JourneyCard =
  | InfoCard
  | FieldCard
  | MultiCard
  | AiCard
  | ReviewCard
  | TerminalCard

// ─── Answers ────────────────────────────────────────────────────────────

/** Draft shape shared by every row-level entry. `clientDraftId` is generated
 *  once per row when the user adds it; the terminal apply playbook uses it
 *  as an idempotency key so a replay can't duplicate rows. */
interface BaseDraft {
  clientDraftId: string
}

export type PaymentMethodDraft = BaseDraft &
  Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'> & {
    /** For credit-card PMs, opening balance owed (mapped into auto-created Debt). */
    openingBalanceOwed?: number
  }

export type IncomeSourceDraft = BaseDraft &
  Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt' | 'paymentMethodId'> & {
    /** PM the user picked in the previous card, keyed by draft id. The apply
     *  playbook resolves this to a real `paymentMethodId` after
     *  `addPaymentMethod` returns. `paymentMethodId` on the server type is
     *  nullable, so omitting it (or leaving the draft id unresolved) is
     *  tolerated. */
    paymentMethodClientDraftId?: string
  }

export type DebtDraft = BaseDraft &
  Omit<Debt, 'id' | 'createdAt' | 'updatedAt'> & {
    /** If set, create a RecurringDebtPayment after the Debt itself. */
    recurringPayment?: {
      amount: number
      currency: Currency | 'XAU'
      frequency: DebtRecurringFrequency
      nextDueDate: string
      paymentMethodClientDraftId: string
    }
  }

export type SubscriptionDraft = BaseDraft &
  Omit<Subscription, 'id' | 'createdAt' | 'updatedAt' | 'linkedRecurringExpenseId'> & {
    paymentMethodClientDraftId: string
  }

export type SavingsAccountDraft = BaseDraft &
  Omit<SavingsAccount, 'id' | 'createdAt' | 'updatedAt'> & {
    openingBalance?: number
    recurringDeposit?: {
      amount: number
      currency: Currency
      dayOfMonth: number
      frequency: 'monthly' | 'biweekly' | 'weekly'
    }
  }

export interface GoalDraft extends BaseDraft {
  name: string
  category: GoalCategory
  targetAmount: number
  currency: Currency
  targetDate?: string
  linkedSavingsAccountClientDraftIds?: string[]
  linkedDebtClientDraftIds?: string[]
}

export interface BudgetPlanCategoryDraft {
  name: string
  icon?: string
  amount: number
  currency: Currency
  subcategories?: Array<{ name: string; amount: number }>
}

/** Typed answer registry. Every card reads/writes through one of these
 *  slots; nothing is duplicated across sections. */
export interface JourneyAnswers {
  journeyMode?: 'quick' | 'guided'
  identity: {
    displayName?: string
    country?: string
    city?: string
    baseCurrency?: Currency
    household?: 'solo' | 'couple' | 'family'
  }
  /** Populated by the AI describe card at the end of phase 2. */
  aiSeed?: ParsedBudgetInput
  moneyIn: {
    paymentMethods: PaymentMethodDraft[]
    incomeSources: IncomeSourceDraft[]
  }
  moneyOut: {
    /** Explicit gate answer ('no' → skip debt list entirely). */
    hasDebts?: 'yes' | 'no'
    debts: DebtDraft[]
    subscriptions: SubscriptionDraft[]
  }
  future: {
    hasSavings?: 'yes' | 'no'
    savingsAccounts: SavingsAccountDraft[]
    goals: GoalDraft[]
  }
  /** Populated by the generate card. */
  aiPlan?: {
    categories: BudgetPlanCategoryDraft[]
    source: 'ai' | 'preset'
    acceptedAt?: string
  }
}

/** Empty scaffolding used by the runner when migrating from flow v2. */
export function emptyJourneyAnswers(): JourneyAnswers {
  return {
    identity: {},
    moneyIn: { paymentMethods: [], incomeSources: [] },
    moneyOut: { debts: [], subscriptions: [] },
    future: { savingsAccounts: [], goals: [] },
  }
}

// ─── Dotted-path helpers ────────────────────────────────────────────────

/** Union of every dotted path into JourneyAnswers that a card may write to.
 *  Limited to the slots cards actually own; multi-card entries are appended
 *  via the runner, not written with setByPath. */
export type JourneyAnswerPath =
  | 'journeyMode'
  | 'identity.displayName'
  | 'identity.country'
  | 'identity.city'
  | 'identity.baseCurrency'
  | 'identity.household'
  | 'aiSeed'
  | 'moneyIn.paymentMethods'
  | 'moneyIn.incomeSources'
  | 'moneyOut.hasDebts'
  | 'moneyOut.debts'
  | 'moneyOut.subscriptions'
  | 'future.hasSavings'
  | 'future.savingsAccounts'
  | 'future.goals'
  | 'aiPlan'
