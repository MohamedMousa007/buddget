import { describe, expect, it } from 'vitest'
import { isDisposableEmail } from './disposable'

describe('isDisposableEmail', () => {
  it('flags throwaway domains and their subdomains, not real providers', () => {
    expect(isDisposableEmail('a@mailinator.com')).toBe(true)
    expect(isDisposableEmail('a@X.YOPMAIL.COM')).toBe(true)
    expect(isDisposableEmail('a@gmail.com')).toBe(false)
    expect(isDisposableEmail('a@notmailinator.com')).toBe(false)
  })
})
