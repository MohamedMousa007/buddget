'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

export type DraftEntryEntity =
  | 'paymentMethods'
  | 'incomeSources'
  | 'debts'
  | 'subscriptions'
  | 'savingsAccounts'
  | 'goals'

/**
 * Mid-modal draft persistence into `onboarding_state.draft_entries`.
 * Active on `/onboarding` while the user has not completed onboarding.
 */
export interface DraftEntryApi<T extends object> {
  initial: Partial<T> | null
  update: (partial: Partial<T>) => void
  clear: () => void
  active: boolean
}

const DEBOUNCE_MS = 500

function draftKeyForEntity(entity: DraftEntryEntity): string {
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

export function useDraftEntry<T extends object>(entity: DraftEntryEntity): DraftEntryApi<T> {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const onOnboardingRoute = pathname?.startsWith('/onboarding') ?? false
  const onboardingIncomplete = Boolean(user && user.user_metadata?.onboarding_completed !== true)
  const active = !loading && onOnboardingRoute && onboardingIncomplete

  const { persistedDrafts, setOnboardingState } = useFinanceStore(
    useShallow((s) => ({
      persistedDrafts: s.onboardingState.draftEntries,
      setOnboardingState: s.setOnboardingState,
    })),
  )

  const draftKey = useMemo(() => draftKeyForEntity(entity), [entity])

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
