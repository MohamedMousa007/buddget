'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { JOURNEY_CARDS } from '@/lib/onboarding/journeyConfig'
import type { ModalCard } from '@/lib/onboarding/journeyTypes'

/**
 * Mid-modal draft persistence — master plan §11.
 *
 * When a user opens an entity modal during the Journey and fills in
 * half the form before their browser tab closes, we want to resume to
 * the same half-filled state, not an empty form. The storage layer is
 * `onboarding_state.draft_entries` (JSONB, keyed by modal id). Client
 * writes are debounced ~500 ms; clears happen on successful save.
 *
 * Modals opt in by calling `useDraftEntry('paymentMethods')`. The hook
 * auto-detects whether the Journey is currently parked on the matching
 * ModalCard — if yes, draft persistence is active; if no (regular
 * in-app modal use), the API is a no-op and the modal behaves exactly
 * as before. No prop-drilling, no context provider — the store itself
 * is the single source of truth for "are we in onboarding?"
 *
 * The "active" signal is: `onboardingState.currentStepIndex` points at
 * a `ModalCard` whose `entity` matches the caller's argument, AND
 * `onboarding_completed` is not true. This keeps drafts from firing
 * for returning users who happen to open a modal while their
 * currentStepIndex persists stale.
 */

export interface DraftEntryApi<T extends object> {
  /** Snapshot of the persisted draft at the *first* render. Use this
   *  to seed form `useState` initial values. Later writes don't
   *  update this reference — the form owns the live state. */
  initial: Partial<T> | null
  /** Write the current form snapshot to the draft store. Debounced
   *  ~500 ms so rapid keystrokes only produce one sync round-trip. */
  update: (partial: Partial<T>) => void
  /** Drop the draft — call on successful save. */
  clear: () => void
  /** `true` when this consumer is on the Journey's current ModalCard
   *  and drafts will actually persist. */
  active: boolean
}

const DEBOUNCE_MS = 500

function draftKeyForEntity(entity: ModalCard['entity']): string {
  // Stable JSONB keys under `onboarding_state.draft_entries`.
  switch (entity) {
    case 'paymentMethods':
      return 'pmDraft'
    case 'incomeSources':
      return 'incomeDraft'
    case 'debts':
      return 'debtDraft'
    case 'subscriptions':
      return 'subscriptionDraft'
    case 'savingsAccounts':
      return 'savingsDraft'
    case 'goals':
      return 'goalDraft'
  }
}

/**
 * Find the ModalCard entity the Journey is currently parked on, or
 * null if the current card isn't a modal. Only meaningful when the
 * user is actually on `/onboarding` — stale `currentStepIndex` values
 * from prior journey sessions don't fire drafts on random app routes.
 */
function currentJourneyModalEntity(
  currentStepIndex: number,
  onOnboardingRoute: boolean,
): ModalCard['entity'] | null {
  if (!onOnboardingRoute) return null
  const card = JOURNEY_CARDS[currentStepIndex]
  if (!card || card.kind !== 'modal') return null
  return card.entity
}

export function useDraftEntry<T extends object>(
  entity: ModalCard['entity'],
): DraftEntryApi<T> {
  const pathname = usePathname()
  const onOnboardingRoute = pathname?.startsWith('/onboarding') ?? false

  const { persistedDrafts, setOnboardingState, active } = useFinanceStore(
    useShallow((s) => {
      const parkedEntity = currentJourneyModalEntity(
        s.onboardingState.currentStepIndex ?? 0,
        onOnboardingRoute,
      )
      return {
        persistedDrafts: s.onboardingState.draftEntries,
        setOnboardingState: s.setOnboardingState,
        active: parkedEntity === entity,
      }
    }),
  )

  const draftKey = useMemo(() => draftKeyForEntity(entity), [entity])

  // Snapshot the initial value once per mount so form `useState`
  // initialisers don't re-seed on every subsequent draft write.
  // Using lazy initial state is safe during render (unlike ref
  // mutation, which the react-hooks/refs rule forbids).
  const [initial] = useState<Partial<T> | null>(() => {
    if (!active) return null
    const existing = persistedDrafts[draftKey]
    return existing && typeof existing === 'object'
      ? (existing as Partial<T>)
      : ({} as Partial<T>)
  })

  const timerRef = useRef<number | null>(null)
  const latestSnapshotRef = useRef<Partial<T> | null>(null)

  const update = useCallback(
    (partial: Partial<T>) => {
      if (!active) return
      latestSnapshotRef.current = partial
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        const snapshot = latestSnapshotRef.current
        if (snapshot === null) return
        setOnboardingState((prev) => ({
          ...prev,
          draftEntries: { ...prev.draftEntries, [draftKey]: snapshot },
        }))
      }, DEBOUNCE_MS)
    },
    [active, draftKey, setOnboardingState],
  )

  const clear = useCallback(() => {
    if (!active) return
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    latestSnapshotRef.current = null
    setOnboardingState((prev) => {
      if (!(draftKey in prev.draftEntries)) return prev
      const next = { ...prev.draftEntries }
      delete next[draftKey]
      return { ...prev, draftEntries: next }
    })
  }, [active, draftKey, setOnboardingState])

  // Flush a pending debounced write if the consumer unmounts mid-stroke.
  useEffect(() => {
    return () => {
      if (timerRef.current === null) return
      window.clearTimeout(timerRef.current)
      const snapshot = latestSnapshotRef.current
      if (snapshot === null || !active) return
      setOnboardingState((prev) => ({
        ...prev,
        draftEntries: { ...prev.draftEntries, [draftKey]: snapshot },
      }))
    }
  }, [active, draftKey, setOnboardingState])

  return {
    initial: active ? initial : null,
    update,
    clear,
    active,
  }
}
