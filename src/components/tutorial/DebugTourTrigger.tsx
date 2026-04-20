'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTutorial } from '@/hooks/useTutorial'

/**
 * Dev-only: when the app loads with `?debugTour=1`, fire the smoke tour
 * once so we can manually verify the overlay engine end-to-end (spotlight
 * positions correctly, keyboard shortcuts work, persistence survives a
 * reload, etc.).
 *
 * Guarded to NODE_ENV !== 'production' so it can never trigger in
 * deployed builds. Zero footprint when the query isn't present.
 *
 * The smoke tour's three steps point at anchors (`debug:fab`,
 * `debug:checklist`, `debug:nav-home`) that are attached by
 * `DebugTourAnchors`, rendered elsewhere in the layout.
 */
export function DebugTourTrigger() {
  const params = useSearchParams()
  const { start, isRunning, isCompleted } = useTutorial()

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    if (params.get('debugTour') !== '1') return
    if (isRunning || isCompleted('debugSmoke')) return
    start('debugSmoke')
  }, [params, start, isRunning, isCompleted])

  return null
}
