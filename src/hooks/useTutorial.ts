'use client'

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
