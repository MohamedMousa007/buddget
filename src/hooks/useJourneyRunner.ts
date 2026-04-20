'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { JOURNEY_EVENTS, track } from '@/lib/analytics/events'
import {
  JOURNEY_PHASES,
  type JourneyAnswerPath,
  type JourneyAnswers,
  type JourneyCard,
  type JourneyPhase,
} from '@/lib/onboarding/journeyTypes'
import {
  isJourneyAnswersV3,
  migrateAnswersV2toV3,
} from '@/lib/onboarding/journeyMigration'

/**
 * State machine for the onboarding Journey (flow v3).
 *
 * Responsibilities:
 *   - Run the v2→v3 migration once on mount when needed.
 *   - Compute the *visible* card sequence by filtering out cards whose
 *     `condition(answers)` returns false.
 *   - Own the current-card cursor (persisted via
 *     `onboardingState.currentStepIndex` so mid-journey refresh resumes
 *     exactly where the user left off).
 *   - Provide typed writers for answers: `setAnswer` for single slots,
 *     `replaceEntries` for multi-card lists, `addEntry` / `removeEntry`.
 *   - Emit analytics events at phase boundaries + on advance/back/skip.
 *
 * The hook is UI-agnostic; `JourneyRunner.tsx` renders whatever card this
 * hook says is current. Call sites outside the runner should not use it.
 */
export interface UseJourneyRunnerArgs {
  cards: ReadonlyArray<JourneyCard>
}

export interface UseJourneyRunnerReturn {
  /** The visible-card subsequence (post `condition` filter). */
  visibleCards: ReadonlyArray<JourneyCard>
  /** The currently-rendered card, or null if the journey is complete. */
  currentCard: JourneyCard | null
  /** Index into `visibleCards` — intentionally not the absolute index. */
  visibleIndex: number
  /** 0..1, by phase progress (not card count — that would jump as
   *  conditionals add/remove cards). */
  progress: number
  /** Typed answers registry (post-migration). */
  answers: JourneyAnswers
  canGoBack: boolean
  canAdvance: boolean
  advance: () => void
  back: () => void
  skip: (reason?: string) => void
  setAnswer: (path: JourneyAnswerPath, value: unknown) => void
  /** Replace an entire multi-card list (e.g. `moneyIn.paymentMethods`). */
  replaceEntries: (path: JourneyAnswerPath, entries: unknown[]) => void
}

export function useJourneyRunner({ cards }: UseJourneyRunnerArgs): UseJourneyRunnerReturn {
  const migrationRan = useRef(false)
  const startedFired = useRef(false)
  const lastPhaseFired = useRef<JourneyPhase | null>(null)

  const { rawAnswers, currentStepIndex, setOnboardingState } = useFinanceStore(
    useShallow((s) => ({
      rawAnswers: s.onboardingState.answers,
      currentStepIndex: s.onboardingState.currentStepIndex ?? 0,
      setOnboardingState: s.setOnboardingState,
    })),
  )

  // ── Migration (once per mount while v2) ────────────────────────────
  useEffect(() => {
    if (migrationRan.current) return
    migrationRan.current = true
    if (!isJourneyAnswersV3(rawAnswers)) {
      const migrated = migrateAnswersV2toV3(rawAnswers)
      setOnboardingState((prev) => ({
        ...prev,
        answers: migrated as unknown as Record<string, unknown>,
        // Keep currentStepIndex: if the user was mid-core-gate we restart
        // them at Welcome rather than landing mid-identity. Simpler than
        // mapping legacy step indices to journey cards.
        currentStepIndex: 0,
      }))
    }
  }, [rawAnswers, setOnboardingState])

  // Runtime cast — safe after migration guarantees the shape.
  const answers: JourneyAnswers = useMemo(() => {
    return isJourneyAnswersV3(rawAnswers)
      ? (rawAnswers as unknown as JourneyAnswers)
      : migrateAnswersV2toV3(rawAnswers)
  }, [rawAnswers])

  // ── Visibility filter ───────────────────────────────────────────────
  const visibleCards = useMemo(
    () => cards.filter((c) => !c.condition || c.condition(answers)),
    [cards, answers],
  )

  // Clamp the persisted cursor into the visible range — conditionals may
  // have shrunk the sequence since last render (e.g. switching to Quick
  // start mid-journey).
  const visibleIndex = Math.min(
    Math.max(0, currentStepIndex),
    Math.max(0, visibleCards.length - 1),
  )
  const currentCard = visibleCards[visibleIndex] ?? null

  // ── Analytics: started + phase-entered ─────────────────────────────
  useEffect(() => {
    if (startedFired.current) return
    startedFired.current = true
    track(JOURNEY_EVENTS.started)
  }, [])

  useEffect(() => {
    const phase = currentCard?.phase ?? null
    if (!phase) return
    if (lastPhaseFired.current === phase) return
    lastPhaseFired.current = phase
    track(JOURNEY_EVENTS.phaseEntered, { phase })
  }, [currentCard?.phase])

  // ── Progress (phase-based, stable under conditional changes) ───────
  const progress = useMemo(() => {
    if (!currentCard) return 1
    const idx = JOURNEY_PHASES.indexOf(currentCard.phase)
    return idx < 0 ? 0 : idx / (JOURNEY_PHASES.length - 1)
  }, [currentCard])

  // ── Writers ────────────────────────────────────────────────────────
  const writeAnswers = useCallback(
    (mutator: (prev: JourneyAnswers) => JourneyAnswers) => {
      setOnboardingState((prev) => {
        const current = isJourneyAnswersV3(prev.answers)
          ? (prev.answers as unknown as JourneyAnswers)
          : migrateAnswersV2toV3(prev.answers)
        const next = mutator(current)
        return { ...prev, answers: next as unknown as Record<string, unknown> }
      })
    },
    [setOnboardingState],
  )

  const setAnswer = useCallback(
    (path: JourneyAnswerPath, value: unknown) => {
      writeAnswers((prev) => setByPath(prev, path, value))
    },
    [writeAnswers],
  )

  const replaceEntries = useCallback(
    (path: JourneyAnswerPath, entries: unknown[]) => {
      writeAnswers((prev) => setByPath(prev, path, entries))
    },
    [writeAnswers],
  )

  // ── Navigation ─────────────────────────────────────────────────────
  const setVisibleIndex = useCallback(
    (next: number) => {
      setOnboardingState((prev) => ({ ...prev, currentStepIndex: next }))
    },
    [setOnboardingState],
  )

  const canGoBack = visibleIndex > 0 && currentCard != null
  const canAdvance = currentCard != null && visibleIndex < visibleCards.length - 1

  const advance = useCallback(() => {
    if (!currentCard) return
    track(JOURNEY_EVENTS.cardCompleted, { cardId: currentCard.id })
    if (canAdvance) setVisibleIndex(visibleIndex + 1)
  }, [canAdvance, currentCard, setVisibleIndex, visibleIndex])

  const back = useCallback(() => {
    if (!canGoBack || !currentCard) return
    track(JOURNEY_EVENTS.backPressed, { cardId: currentCard.id })
    setVisibleIndex(visibleIndex - 1)
  }, [canGoBack, currentCard, setVisibleIndex, visibleIndex])

  const skip = useCallback(
    (reason?: string) => {
      if (!currentCard) return
      track(JOURNEY_EVENTS.cardSkipped, {
        cardId: currentCard.id,
        reason: reason ?? 'user',
      })
      if (canAdvance) setVisibleIndex(visibleIndex + 1)
    },
    [canAdvance, currentCard, setVisibleIndex, visibleIndex],
  )

  return {
    visibleCards,
    currentCard,
    visibleIndex,
    progress,
    answers,
    canGoBack,
    canAdvance,
    advance,
    back,
    skip,
    setAnswer,
    replaceEntries,
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Immutable deep-set by dotted path. Only walks through plain objects;
 *  array slots are replaced wholesale (the runner never reaches into a
 *  specific array index — that's what multi-card editors own). Generic
 *  is unconstrained so typed answer shapes like `JourneyAnswers` are
 *  accepted without requiring an index signature. */
function setByPath<T>(obj: T, path: string, value: unknown): T {
  const parts = path.split('.')
  const copy = structuredClone(obj) as unknown as Record<string, unknown>
  let cursor: Record<string, unknown> = copy
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    const next = cursor[key]
    if (next == null || typeof next !== 'object' || Array.isArray(next)) {
      cursor[key] = {}
    }
    cursor = cursor[key] as Record<string, unknown>
  }
  cursor[parts[parts.length - 1]] = value
  return copy as unknown as T
}
