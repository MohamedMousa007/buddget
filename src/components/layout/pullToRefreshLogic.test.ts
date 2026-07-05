import { describe, it, expect } from 'vitest'
import { resistedPull, canEngage, shouldCommit, THRESHOLD, MAX_PULL } from './pullToRefreshLogic'

describe('pull-to-refresh gesture logic (BUD-57)', () => {
  it('never engages when the gesture starts mid-page or at the bottom', () => {
    // The core BUD-57 bug: a hard scroll from mid-page must not trigger refresh.
    expect(canEngage(300)).toBe(false)
    expect(canEngage(1)).toBe(false)
    expect(shouldCommit(300, 500)).toBe(false) // big pull, but started mid-page
  })

  it('engages only when the gesture begins at the very top', () => {
    expect(canEngage(0)).toBe(true)
    expect(canEngage(-2)).toBe(true) // iOS overscroll can report slightly negative
  })

  it('applies resistance and caps the pull', () => {
    expect(resistedPull(100)).toBe(50) // 0.5 resistance
    expect(resistedPull(1000)).toBe(MAX_PULL) // capped
    expect(resistedPull(0)).toBe(0)
    expect(resistedPull(-50)).toBe(0) // upward = no pull
  })

  it('commits only past the threshold, from the top', () => {
    const needed = THRESHOLD / 0.5 // finger px required to reach the commit line
    expect(shouldCommit(0, needed - 1)).toBe(false) // just short → no refresh
    expect(shouldCommit(0, needed)).toBe(true) // at the line → refresh
    expect(shouldCommit(0, 40)).toBe(false) // tiny pull → no accidental refresh
  })
})
