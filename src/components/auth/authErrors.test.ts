import { describe, expect, it } from 'vitest'
import { mapOAuthCallbackReason, mapOAuthError } from '@/components/auth/authErrors'
import { en } from '@/lib/i18n/dictionaries/en'

describe('mapOAuthCallbackReason', () => {
  it('maps access_denied to cancelled', () => {
    expect(mapOAuthCallbackReason('access_denied')).toBe('cancelled')
  })

  it('maps exchange_failed', () => {
    expect(mapOAuthCallbackReason('exchange_failed')).toBe('exchange_failed')
  })
})

describe('mapOAuthError', () => {
  it('returns cancelled copy', () => {
    expect(mapOAuthError(null, 'cancelled', en)).toBe(en.auth.oauthCancelled)
  })

  it('returns failed copy for exchange errors with ref code', () => {
    expect(mapOAuthError(null, 'exchange_failed', en)).toBe(`${en.auth.oauthFailed} (ref: EXCHANGE)`)
  })

  it('maps provider-not-enabled messages', () => {
    expect(mapOAuthError(new Error('Provider is not enabled'), null, en)).toBe(
      `${en.auth.oauthUnavailable} (ref: PROVIDER)`,
    )
  })

  it('extracts message from plain {message:string} object but never leaks raw text to UI', () => {
    // Unrecognised plugin messages fall through to the generic fallback — never verbatim.
    expect(mapOAuthError({ message: 'native sign-in failed' }, null, en)).toBe(
      `${en.auth.oauthFailed} (ref: GENERIC)`,
    )
  })

  it('coerces non-string message property to string then applies generic fallback', () => {
    expect(mapOAuthError({ message: 42 }, null, en)).toBe(`${en.auth.oauthFailed} (ref: GENERIC)`)
  })

  it('maps Android Google activity error to oauthFailed [ANDROID_GOOGLE]', () => {
    expect(mapOAuthError(new Error('Cannot use scopes without main activity'), null, en)).toBe(`${en.auth.oauthFailed} (ref: ANDROID_GOOGLE)`)
    expect(mapOAuthError(new Error('no main activity found'), null, en)).toBe(`${en.auth.oauthFailed} (ref: ANDROID_GOOGLE)`)
  })

  it('maps Apple invalid redirect error to oauthUnavailable [APPLE_REDIRECT]', () => {
    expect(mapOAuthError(new Error('invalid_request: invalid web redirect url'), null, en)).toBe(`${en.auth.oauthUnavailable} (ref: APPLE_REDIRECT)`)
    expect(mapOAuthError(new Error('redirect_uri mismatch'), null, en)).toBe(`${en.auth.oauthUnavailable} (ref: APPLE_REDIRECT)`)
  })

  it('maps auth_timeout to oauthCancelled (no ref code — cancellation is not a failure)', () => {
    expect(mapOAuthError(new Error('auth_timeout'), null, en)).toBe(en.auth.oauthCancelled)
  })

  it('maps no identity token error to oauthFailed [NO_TOKEN]', () => {
    expect(mapOAuthError(new Error('No identity token returned'), null, en)).toBe(`${en.auth.oauthFailed} (ref: NO_TOKEN)`)
  })
})
