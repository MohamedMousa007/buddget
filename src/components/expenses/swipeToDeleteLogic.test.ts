import { describe, it, expect } from 'vitest'
import { resolveSwipe, COMMIT_FRACTION } from './swipeToDeleteLogic'

const W = 320
const THRESH = W * COMMIT_FRACTION // 272px

describe('swipe-to-delete commit logic', () => {
  it('deletes on a near-full leftward swipe', () => {
    expect(resolveSwipe(-THRESH, W)).toBe(true)
    expect(resolveSwipe(-W, W)).toBe(true)
  })

  it('snaps back on a shallow leftward swipe', () => {
    expect(resolveSwipe(-(THRESH - 1), W)).toBe(false)
    expect(resolveSwipe(-50, W)).toBe(false)
    expect(resolveSwipe(0, W)).toBe(false)
  })

  it('never deletes on a rightward swipe (one direction only)', () => {
    expect(resolveSwipe(W, W)).toBe(false)
    expect(resolveSwipe(THRESH, W)).toBe(false)
  })

  it('is inert without a measured width', () => {
    expect(resolveSwipe(-9999, 0)).toBe(false)
  })
})
