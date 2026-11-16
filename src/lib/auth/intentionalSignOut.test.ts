import { describe, expect, it } from 'vitest'
import { consumeExpectedSignOut, expectSignOut } from './intentionalSignOut'

describe('expected sign-out (2FA hand-off is not "session expired")', () => {
  it('is consumed exactly once', () => {
    expect(consumeExpectedSignOut()).toBe(false)
    expectSignOut()
    expect(consumeExpectedSignOut()).toBe(true)
    expect(consumeExpectedSignOut()).toBe(false)
  })
})
