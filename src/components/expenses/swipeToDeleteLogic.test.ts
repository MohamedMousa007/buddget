import { describe, it, expect } from 'vitest'
import { resolveSwipe, REVEAL } from './swipeToDeleteLogic'

describe('swipe-to-delete snap logic', () => {
  it('opens when dragged past halfway with no fling', () => {
    expect(resolveSwipe(-50, 0)).toBe(-REVEAL) // 50 > REVEAL/2
  })

  it('stays closed when barely dragged', () => {
    expect(resolveSwipe(-10, 0)).toBe(0)
    expect(resolveSwipe(0, 0)).toBe(0)
  })

  it('a fast left fling opens even from a small offset', () => {
    expect(resolveSwipe(-5, -900)).toBe(-REVEAL)
  })

  it('a fast right fling closes even when past halfway', () => {
    expect(resolveSwipe(-80, 900)).toBe(0)
  })

  it('velocity within the deadzone defers to position', () => {
    expect(resolveSwipe(-70, 200)).toBe(-REVEAL) // slow drift, mostly open
    expect(resolveSwipe(-20, -200)).toBe(0) // slow drift, mostly closed
  })
})
