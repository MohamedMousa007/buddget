'use client'

import { useEffect, useRef } from 'react'
import { useTutorialController } from '@/components/tutorial/TutorialController'
import type { TourId } from '@/lib/tutorial/anchorManifest'

/**
 * Consumer API for firing tours + reading state from feature components.
 * Kept narrow so call sites can't accidentally drive internal state.
 */
export function useTutorial() {
  const c = useTutorialController()
  return {
    /** Launch a tour. No-op if the tour is already running or completed
     *  at its current version. */
    start: (tourId: TourId) => {
      if (c.isCompleted(tourId)) return
      c.start(tourId)
    },
    /** End the currently-active tour and mark it completed. */
    skipAll: c.skipAll,
    /** True when a tour has already run to completion for this user. */
    isCompleted: c.isCompleted,
    /** True while a tour is actively being shown. */
    isRunning: c.status === 'running',
    activeTourId: c.activeTourId,
  }
}

/**
 * Arm a tour the first time a modal opens, and close the tour cleanly when
 * the modal closes mid-run. Designed for the Add* modal sheets, where the
 * tour's lifecycle should match the modal's lifecycle.
 *
 * @param tourId    The tour to start (e.g. `addPmTour`).
 * @param isOpen    True while the modal is visible. Going false closes the
 *                  tour with `skipAll` if this hook owned the active tour.
 */
export function useAutoStartTour(tourId: TourId, isOpen: boolean) {
  const c = useTutorialController()
  const armedRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      if (armedRef.current) return
      if (c.isCompleted(tourId)) return
      armedRef.current = true
      c.start(tourId)
      return
    }
    if (armedRef.current) {
      armedRef.current = false
      if (c.activeTourId === tourId && c.status === 'running') {
        c.skipAll()
      }
    }
  }, [isOpen, tourId, c])
}
