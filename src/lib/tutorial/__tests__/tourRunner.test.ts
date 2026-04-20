import { describe, it, expect } from 'vitest'
import {
  advance,
  buildResumeMarker,
  createSession,
  currentStep,
  isAtEnd,
  isTourCompleted,
  parseResumeMarker,
  retreat,
  stepsForTour,
} from '@/lib/tutorial/tourRunner'
import { TOUR_VERSIONS, tourStorageKey } from '@/lib/tutorial/anchorManifest'

describe('tourRunner · stepsForTour', () => {
  it('returns the debug tour steps in manifest order', () => {
    const steps = stepsForTour('debugSmoke')
    expect(steps.length).toBe(3)
    expect(steps[0].anchorId).toBe('debug:fab')
    expect(steps[1].anchorId).toBe('debug:checklist')
    expect(steps[2].anchorId).toBe('debug:nav-home')
  })
})

describe('tourRunner · session navigation', () => {
  it('advances + retreats cleanly', () => {
    const s = createSession('debugSmoke')
    expect(s.stepIndex).toBe(0)
    expect(currentStep(s)?.anchorId).toBe('debug:fab')

    const s2 = advance(s)
    expect(s2.stepIndex).toBe(1)
    expect(currentStep(s2)?.anchorId).toBe('debug:checklist')

    const back = retreat(s2)
    expect(back.stepIndex).toBe(0)
  })

  it('isAtEnd flips when past the last step', () => {
    let s = createSession('debugSmoke')
    for (let i = 0; i < 3; i++) s = advance(s)
    expect(isAtEnd(s)).toBe(true)
  })

  it('retreat cannot go below zero', () => {
    const s = createSession('debugSmoke')
    expect(retreat(s).stepIndex).toBe(0)
  })
})

describe('tourRunner · completion + resume markers', () => {
  it('detects a completed tour at the current version', () => {
    const key = tourStorageKey('debugSmoke')
    expect(isTourCompleted('debugSmoke', [])).toBe(false)
    expect(isTourCompleted('debugSmoke', [key])).toBe(true)
  })

  it('does not treat a stale-version completion as valid', () => {
    expect(isTourCompleted('debugSmoke', ['debugSmoke:v999'])).toBe(false)
  })

  it('round-trips a resume marker', () => {
    const sess = createSession('debugSmoke', 2)
    const marker = buildResumeMarker(sess)
    const parsed = parseResumeMarker(marker)
    expect(parsed?.tourId).toBe('debugSmoke')
    expect(parsed?.version).toBe(TOUR_VERSIONS.debugSmoke)
    expect(parsed?.stepIndex).toBe(2)
  })

  it('rejects a stale-version resume marker', () => {
    expect(parseResumeMarker('debugSmoke:v999:0')).toBeNull()
  })

  it('rejects malformed markers', () => {
    expect(parseResumeMarker('nope')).toBeNull()
    expect(parseResumeMarker('')).toBeNull()
    expect(parseResumeMarker(null)).toBeNull()
  })
})
