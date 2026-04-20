/**
 * Accumulator: turns `JourneyAnswers` + live Zustand state into the
 * inputs needed to ask the AI for a personalised budget plan (and a
 * preset-derived initial category set used as both the AI's seed and
 * its graceful fallback).
 *
 * Pure function — no side effects. The caller (`generateJourneyPlan`)
 * owns the AI call + error handling.
 */

import type { Currency } from '@/lib/store/types'
import type { BudgetCategoryRow } from '@/lib/budget/lifestyleMappings'
import type { JourneyAnswers } from '@/lib/onboarding/journeyTypes'
import { anchorsForCountry, COST_ANCHORS } from '@/lib/budget/costOfLivingAnchors'
import {
  budgetCategoriesFromPreset,
  type BudgetPresetId,
} from '@/lib/onboarding/budgetPresets'

/** Category glyphs mirror the deterministic set used elsewhere in the
 *  app (see `computeBudgetFromChoices`). Keep emojis simple so the AI
 *  can override them without forcing a particular visual identity. */
const DEFAULT_EMOJI: Record<string, string> = {
  Rent: '🏠',
  Transport: '🚗',
  Food: '🍽️',
  Enjoyment: '✨',
  Savings: '💰',
  Debt: '💳',
  Remittance: '🌐',
  Other: '📦',
}

export interface JourneyPlanContext {
  /** Starting category set derived from the preset percentages × income,
   *  scaled by the country cost-anchor factor. Used as the AI's seed
   *  AND as the fallback when the AI call fails. */
  initialCategories: BudgetCategoryRow[]
  /** Monthly income the plan is sized against (already in baseCurrency,
   *  post-conversion if multiple currencies in play). */
  income: number
  currency: Currency
  city: string
  country: string | null
  household: 'solo' | 'couple' | 'family'
  /** Human-readable summary fed to `regenerateBudgetPlanWithAi` as its
   *  `feedback` parameter. Encodes everything the user told us during
   *  the Journey so the AI can personalise rather than re-ask. */
  feedback: string
}

export interface BuildAiPlanContextArgs {
  answers: JourneyAnswers
  /** Monthly income in baseCurrency, calculated from the income sources
   *  the user added during the Journey. */
  monthlyIncomeInBase: number
  baseCurrency: Currency
  /** Count of each entity captured during onboarding — only used in the
   *  AI feedback string to inform the personalisation. */
  counts: {
    paymentMethods: number
    incomeSources: number
    debts: number
    subscriptions: number
    savingsAccounts: number
    goals: number
  }
  /** First goal the user picked (name + category). Helps the AI weight
   *  the Savings vs Debt vs Other split. */
  primaryGoalName?: string
  primaryGoalCategory?: string
}

/** Pick a preset that roughly matches the user's stated goal. */
function presetForGoal(goalCategory: string | undefined): BudgetPresetId {
  if (!goalCategory) return 'balanced'
  if (goalCategory === 'debt_freedom') return 'debt_focus'
  if (
    goalCategory === 'house' ||
    goalCategory === 'emergency_fund' ||
    goalCategory === 'investment'
  ) {
    return 'savings_focus'
  }
  return 'balanced'
}

/** Scale UAE-baseline cost anchors to the user's country. Returns 1.0
 *  when no anchor exists (generic percent-of-income fallback). */
function countryScaleFactor(country: string | null | undefined): number {
  const anchors = anchorsForCountry(country)
  if (!anchors) return 1.0
  const uaeRef = COST_ANCHORS.UAE.groceries.couple
  if (uaeRef <= 0) return 1.0
  return anchors.groceries.couple / uaeRef
}

export function buildAiPlanContext(args: BuildAiPlanContextArgs): JourneyPlanContext {
  const { answers, monthlyIncomeInBase, baseCurrency, counts } = args
  const country = answers.identity.country ?? null
  const city = answers.identity.city ?? ''
  const household = answers.identity.household ?? 'solo'

  // ── Initial preset-derived categories ──────────────────────────────
  const presetId = presetForGoal(args.primaryGoalCategory)
  const presetCats = budgetCategoriesFromPreset(presetId, baseCurrency)
  const scale = countryScaleFactor(country)
  const initialCategories: BudgetCategoryRow[] = presetCats.map((p) => {
    const percent = p.percentOfIncome ?? 0
    const rawAmount = (percent / 100) * monthlyIncomeInBase * scale
    return {
      name: p.category,
      emoji: DEFAULT_EMOJI[p.category] ?? '📌',
      amount: Math.max(0, Math.round(rawAmount)),
      currency: baseCurrency,
      isSavings: p.category === 'Savings',
    }
  })

  // ── Human-readable feedback string ────────────────────────────────
  const lines: string[] = []
  lines.push(`Income: ${monthlyIncomeInBase} ${baseCurrency}/month`)
  lines.push(`Location: ${city ? city + ', ' : ''}${country ?? 'unknown'}`)
  lines.push(`Household: ${household}`)
  if (counts.paymentMethods > 0) lines.push(`Payment methods: ${counts.paymentMethods}`)
  if (counts.debts > 0) lines.push(`Active debts: ${counts.debts}`)
  if (counts.subscriptions > 0) lines.push(`Monthly subscriptions: ${counts.subscriptions}`)
  if (counts.savingsAccounts > 0)
    lines.push(`Savings accounts: ${counts.savingsAccounts}`)
  if (args.primaryGoalName) {
    lines.push(
      `Primary goal: ${args.primaryGoalName}${
        args.primaryGoalCategory ? ` (${args.primaryGoalCategory})` : ''
      }`,
    )
  }
  lines.push(
    "Build a personalised budget that matches the user's life. Tune preset amounts to realistic local prices; keep category names but adjust icons as fit.",
  )

  return {
    initialCategories,
    income: monthlyIncomeInBase,
    currency: baseCurrency,
    city,
    country,
    household,
    feedback: lines.join('\n'),
  }
}
