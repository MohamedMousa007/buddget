'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import type { CreateIntent } from '@/lib/budget/templates'
import type { BudgetBlock } from '@/lib/store/types'

export interface ReviewTarget {
  id: string
  aiNote: boolean
  /** A plan built by hand: segments left empty are flagged too. */
  flagEmpty?: boolean
  /** Segments the user skipped while building. */
  skipped?: BudgetBlock[]
}

/**
 * The Budget page's takeover screens (builder, guided setup, review, chooser, a segment page) are state, not routes:
 * the hardware back steps out one level instead of leaving the tab.
 */
export function useBudgetTakeover(onActivate: (id: string) => void) {
  const store = useFinanceStore
  const [segment, setSegment] = useState<BudgetBlock | null>(null)
  const [building, setBuilding] = useState<string | null>(null)
  const [buildEmpty, setBuildEmpty] = useState(false)
  const [creating, setCreating] = useState(false)
  const [studio, setStudio] = useState<{ intent: CreateIntent | null } | null>(null)
  const [review, setReview] = useState<ReviewTarget | null>(null)

  // Buddgy's chat can start the guided setup; the request is honoured once, here, and cleared.
  const studioRequested = useSettingsStore((s) => s.budgetStudioRequested)
  useEffect(() => {
    if (!studioRequested) return
    useSettingsStore.getState().clearBudgetStudioRequest()
    setStudio({ intent: null })
  }, [studioRequested])

  const openBuilder = useCallback((id: string, empty = false) => {
    setCreating(false)
    setBuildEmpty(empty)
    setBuilding(id)
  }, [])
  const startBuild = useCallback(() => setCreating(true), [])

  // Leaving the builder with nothing in the draft removes it, so empty drafts do not pile up.
  const exitBuilder = useCallback(() => {
    const id = building
    setBuilding(null)
    const s = store.getState()
    const draft = id ? s.budgetPlans.find((p) => p.id === id) : undefined
    if (draft && draft.status === 'draft' && draft.categories.length === 0) s.deleteBudgetPlan(draft.id)
  }, [building, store])

  useEffect(() => {
    if (!building && !studio && !review && !creating && !segment) return
    return registerBackGuard(() => {
      if (building) exitBuilder()
      else if (studio) {
        setStudio(null)
        setCreating(true)
      } else if (review) setReview(null)
      else if (creating) setCreating(false)
      else setSegment(null)
      return true
    })
  }, [building, studio, review, creating, segment, exitBuilder])

  const finishBuild = useCallback(
    (id: string) => {
      setBuilding(null)
      onActivate(id)
    },
    [onActivate],
  )

  return { segment, setSegment, building, setBuilding, buildEmpty, creating, setCreating, studio, setStudio, review, setReview, openBuilder, startBuild, exitBuilder, finishBuild }
}
