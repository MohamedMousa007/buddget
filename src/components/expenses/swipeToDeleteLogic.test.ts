import { describe, it, expect } from 'vitest'
import { resolveSwipe, OPEN_AT } from './swipeToDeleteLogic'

describe('swipe-to-delete open logic', () => {
  it('opens when dragged left past the threshold', () => {
    expect(resolveSwipe(-OPEN_AT)).toBe(true)
    expect(resolveSwipe(-(OPEN_AT + 60))).toBe(true)
  })

  it('stays closed on a shallow left swipe', () => {
    expect(resolveSwipe(-(OPEN_AT - 1))).toBe(false)
    expect(resolveSwipe(-40)).toBe(false)
    expect(resolveSwipe(0)).toBe(false)
  })

  it('never opens on a rightward swipe (one direction only)', () => {
    expect(resolveSwipe(OPEN_AT)).toBe(false)
    expect(resolveSwipe(300)).toBe(false)
  })
})
