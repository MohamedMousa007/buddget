/**
 * One-shot pure migrator from onboarding flow v2 → v3.
 *
 * Flow v2 stored survey-style answers at `onboardingState.answers` as a
 * loose `Record<string, unknown>`. Keys used by the legacy core gate:
 *   - `display_name`, `country`, `city`, `base_currency`, `secondary_currency`
 *
 * Flow v3 (the Journey) uses a typed `JourneyAnswers` registry under the
 * same `answers` slot. Because `OnboardingState.answers` is typed as
 * `Record<string, unknown>`, this migration writes the new shape back
 * into the same slot — runner casts to `JourneyAnswers` after checking
 * `flowVersion >= 3`.
 *
 * Pure function, no store / React dependency. Called from the runner on
 * mount when it sees `flowVersion < 3`.
 */

import { emptyJourneyAnswers, type JourneyAnswers } from '@/lib/onboarding/journeyTypes'
import type { Currency } from '@/lib/store/types'

/** A shallow look at the legacy survey keys we preserve when upgrading. */
interface LegacyAnswersV2 {
  display_name?: unknown
  country?: unknown
  city?: unknown
  base_currency?: unknown
  secondary_currency?: unknown
}

function asTrimmedString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function asCurrency(v: unknown): Currency | undefined {
  if (typeof v !== 'string') return undefined
  const upper = v.trim().toUpperCase()
  // Currency is a string-literal union of ISO codes; accept anything
  // matching the expected shape and let the runtime components validate.
  if (/^[A-Z]{3}$/.test(upper)) return upper as Currency
  return undefined
}

/**
 * Convert a v2 answers blob into a v3 `JourneyAnswers`. Unknown keys are
 * preserved at the top level so surveys added by any future experiment
 * won't lose their state on upgrade (kept under a private `_legacy`
 * bucket that the runner ignores but the Supabase sync round-trips).
 */
export function migrateAnswersV2toV3(
  legacy: Record<string, unknown> | undefined | null,
): JourneyAnswers {
  const next = emptyJourneyAnswers()
  if (!legacy) return next

  const l = legacy as LegacyAnswersV2

  const name = asTrimmedString(l.display_name)
  if (name) next.identity.displayName = name

  const country = asTrimmedString(l.country)
  if (country) next.identity.country = country

  const city = asTrimmedString(l.city)
  if (city) next.identity.city = city

  const base = asCurrency(l.base_currency)
  if (base) next.identity.baseCurrency = base

  return next
}

/**
 * Idempotency predicate used by the runner: returns true when a given
 * answers blob is already in v3 shape (has the typed buckets). The runner
 * calls this before running the migration so re-mounts are free.
 */
export function isJourneyAnswersV3(
  answers: unknown,
): answers is JourneyAnswers {
  if (!answers || typeof answers !== 'object') return false
  const a = answers as Partial<JourneyAnswers>
  return (
    a.identity !== undefined &&
    a.moneyIn !== undefined &&
    a.moneyOut !== undefined &&
    a.future !== undefined
  )
}
