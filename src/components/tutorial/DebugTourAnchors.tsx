'use client'

import { useTutorialAnchor } from '@/components/tutorial/TutorialAnchor'

/**
 * Dev-only: registers the anchor ids the smoke tour spotlights.
 *
 * These anchors **aren't** glued to the real FAB / checklist / nav-home —
 * that would require instrumenting the feature components just for the
 * smoke tour. Instead we render three invisible fixed-position markers
 * (one in each corner + one centered) so the overlay has something real
 * to spotlight. This proves the overlay, cutout math, keyboard, and
 * persistence all work without conflating with real app anchors.
 *
 * Zero footprint outside `?debugTour=1` — the component simply renders
 * three 24x24 transparent divs at fixed positions. Production builds
 * never mount this.
 */
export function DebugTourAnchors() {
  const fab = useTutorialAnchor<HTMLDivElement>('debug:fab')
  const checklist = useTutorialAnchor<HTMLDivElement>('debug:checklist')
  const navHome = useTutorialAnchor<HTMLDivElement>('debug:nav-home')

  if (process.env.NODE_ENV === 'production') return null

  return (
    <>
      {/* Centered marker — simulates the FAB. */}
      <div
        {...fab.anchorProps}
        aria-hidden
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: 9999,
          background: 'rgba(229, 9, 20, 0.15)',
          border: '2px dashed var(--color-brand-red)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      {/* Top marker — simulates the checklist. */}
      <div
        {...checklist.anchorProps}
        aria-hidden
        style={{
          position: 'fixed',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 280,
          height: 120,
          borderRadius: 16,
          background: 'rgba(229, 9, 20, 0.08)',
          border: '2px dashed var(--color-brand-red)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      {/* Bottom-left marker — simulates nav-home on mobile / sidebar-home
          on desktop. */}
      <div
        {...navHome.anchorProps}
        aria-hidden
        style={{
          position: 'fixed',
          left: 24,
          bottom: 24,
          width: 72,
          height: 40,
          borderRadius: 12,
          background: 'rgba(229, 9, 20, 0.08)',
          border: '2px dashed var(--color-brand-red)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
    </>
  )
}
