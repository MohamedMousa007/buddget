/**
 * Pure state machine for a tutorial tour.
 *
 * Given a tour id + the user's `tutorials_completed` list, it computes:
 *   - the ordered step list for that tour (derived from ANCHORS)
 *   - whether the tour should run at all (not yet completed at current version)
 *   - transitions: start / next / back / skip / complete
 *
 * No React, no DOM, no Zustand — easy to unit-test. The runtime layer
 * (`TutorialController`) wraps this with context + side effects (spotlight,
 * persistence, navigation).
 */

import {
  ANCHORS,
  TOUR_VERSIONS,
  tourStorageKey,
  type AnchorEntry,
  type TourId,
} from '@/lib/tutorial/anchorManifest'

export interface TourStep {
  anchorId: string
  entry: AnchorEntry
}

export interface TourSession {
  tourId: TourId
  version: number
  stepIndex: number
  steps: ReadonlyArray<TourStep>
}

export type TourStatus = 'idle' | 'running' | 'paused' | 'complete'

/** Compute the ordered step list for a tour by walking the manifest. */
export function stepsForTour(tourId: TourId): ReadonlyArray<TourStep> {
  const entries: TourStep[] = []
  for (const [anchorId, entry] of Object.entries(ANCHORS)) {
    if (entry.tour !== tourId) continue
    entries.push({ anchorId, entry })
  }
  // Sort by `order` (undefined → stable tail). Undefined orders are fine
  // for debug / ad-hoc tours; production tours should set them explicitly.
  entries.sort((a, b) => (a.entry.order ?? 1e6) - (b.entry.order ?? 1e6))
  return entries
}

/** True if the user's `tutorials_completed` list already contains this
 *  tour at its current version. */
export function isTourCompleted(
  tourId: TourId,
  tutorialsCompleted: ReadonlyArray<string>,
): boolean {
  return tutorialsCompleted.includes(tourStorageKey(tourId))
}

/** Parse a `tutorial_current_step` resume marker like
 *  `'postOnboardingTour:v1:3'`. Returns null if malformed. */
export function parseResumeMarker(
  marker: string | null,
): { tourId: TourId; version: number; stepIndex: number } | null {
  if (!marker) return null
  const match = /^([a-zA-Z]+):v(\d+):(\d+)$/.exec(marker)
  if (!match) return null
  const tourId = match[1] as TourId
  const version = Number(match[2])
  const stepIndex = Number(match[3])
  if (!(tourId in TOUR_VERSIONS)) return null
  if (TOUR_VERSIONS[tourId] !== version) return null // stale marker from old version
  return { tourId, version, stepIndex }
}

export function buildResumeMarker(session: TourSession): string {
  return `${session.tourId}:v${session.version}:${session.stepIndex}`
}

/** Create a fresh session pinned to the current version of the tour. */
export function createSession(tourId: TourId, startAt = 0): TourSession {
  return {
    tourId,
    version: TOUR_VERSIONS[tourId],
    stepIndex: startAt,
    steps: stepsForTour(tourId),
  }
}

export function advance(session: TourSession): TourSession {
  return { ...session, stepIndex: session.stepIndex + 1 }
}

export function retreat(session: TourSession): TourSession {
  return { ...session, stepIndex: Math.max(0, session.stepIndex - 1) }
}

export function currentStep(session: TourSession): TourStep | null {
  return session.steps[session.stepIndex] ?? null
}

export function isAtEnd(session: TourSession): boolean {
  return session.stepIndex >= session.steps.length
}
