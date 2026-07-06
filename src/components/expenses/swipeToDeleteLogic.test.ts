import { describe, it, expect } from 'vitest'
import { resolveSwipe, REVEAL } from './swipeToDeleteLogic'

describe('swipe-to-delete snap logic', () => {
  it('opens end-side when dragged deep enough left with no fling', () => {
    expect(resolveSwipe(-90, 0)).toBe(-REVEAL) // past the 0.7*REVEAL threshold
  })

  it('opens start-side when dragged deep enough right with no fling', () => {
    expect(resolveSwipe(90, 0)).toBe(REVEAL)
  })

  it('stays closed on a shallow swipe in either direction', () => {
    expect(resolveSwipe(-50, 0)).toBe(0) // under the deeper threshold now
    expect(resolveSwipe(50, 0)).toBe(0)
    expect(resolveSwipe(0, 0)).toBe(0)
  })

  it('a fast left fling opens end-side even from a shallow offset', () => {
    expect(resolveSwipe(-10, -900)).toBe(-REVEAL)
  })

  it('a fast right fling opens start-side even from a shallow offset', () => {
    expect(resolveSwipe(10, 900)).toBe(REVEAL)
  })

  it('a fast opposite-direction fling overrides a deep same-direction offset', () => {
    expect(resolveSwipe(-100, 900)).toBe(REVEAL)
    expect(resolveSwipe(100, -900)).toBe(-REVEAL)
  })

  it('velocity within the deadzone defers to position', () => {
    expect(resolveSwipe(-95, 200)).toBe(-REVEAL) // slow drift, deep enough
    expect(resolveSwipe(-30, -200)).toBe(0) // slow drift, not deep enough
  })
})
