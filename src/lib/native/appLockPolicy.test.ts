import { describe, expect, it } from 'vitest'
import { RELOCK_AFTER_MS, beginNativeFlow, endNativeFlow, isNativeFlowActive, shouldRelock, withNativeFlow } from './appLockPolicy'

describe('native flow tracking', () => {
  it('is active between begin and end, and nests', () => {
    expect(isNativeFlowActive()).toBe(false)
    beginNativeFlow(); beginNativeFlow()
    endNativeFlow()
    expect(isNativeFlowActive()).toBe(true)
    endNativeFlow(); endNativeFlow()
    expect(isNativeFlowActive()).toBe(false)
  })
  it('withNativeFlow ends the flow when the call rejects', async () => {
    await expect(withNativeFlow(async () => { expect(isNativeFlowActive()).toBe(true); throw new Error('x') })).rejects.toThrow('x')
    expect(isNativeFlowActive()).toBe(false)
  })
})

describe('shouldRelock', () => {
  it('relocks only after more than the background grace', () => {
    expect(shouldRelock(1000, 1000 + RELOCK_AFTER_MS)).toBe(false)
    expect(shouldRelock(1000, 1000 + RELOCK_AFTER_MS + 1)).toBe(true)
  })
  it('never relocks without a recorded background time', () => {
    expect(shouldRelock(null, 10_000_000)).toBe(false)
  })
  it('treats a clock that went backwards as not elapsed', () => {
    expect(shouldRelock(5000, 1000)).toBe(false)
  })
})
