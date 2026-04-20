'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTutorialController } from '@/components/tutorial/TutorialController'

/**
 * Auto-starts the post-onboarding guided tour when the user lands on
 * `/budget-setup?tour=1` right after finishing the Journey.
 *
 * Responsibilities:
 *   - Fire `startTour('postOnboardingTour')` exactly once per landing.
 *   - Strip the `tour` + `freshPlan` query params so a refresh doesn't
 *     re-fire the tour (controller persists progress anyway).
 *   - No-op if the tour has already been completed at its current
 *     version — future users re-invoke from Settings → Show me around.
 *
 * Rendered invisibly near the top of the `/budget-setup` route.
 */
export function PostOnboardingTourBoot() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const controller = useTutorialController()
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    if (searchParams.get('tour') !== '1') return
    firedRef.current = true

    // Strip the query params first so reloads don't re-arm. Use
    // `replace` so the navigation doesn't pollute back-history.
    const keep = new URLSearchParams(searchParams.toString())
    keep.delete('tour')
    keep.delete('freshPlan')
    const query = keep.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)

    // Skip if already completed at the current version — re-opens
    // happen from Settings.
    if (controller.isCompleted('postOnboardingTour')) return
    controller.start('postOnboardingTour')
  }, [searchParams, controller, pathname, router])

  return null
}
