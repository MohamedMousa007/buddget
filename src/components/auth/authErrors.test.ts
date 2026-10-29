import { describe, expect, it } from 'vitest'
import { isUnknownAccountOtpError, mapAuthError, mapOAuthCallbackReason, mapOAuthError } from '@/components/auth/authErrors'
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

  it('returns clean failed copy for exchange errors (no ref leaked to UI)', () => {
    expect(mapOAuthError(null, 'exchange_failed', en)).toBe(en.auth.oauthFailed)
  })

  it('maps provider-not-enabled messages', () => {
    expect(mapOAuthError(new Error('Provider is not enabled'), null, en)).toBe(en.auth.oauthUnavailable)
  })

  it('extracts message from plain {message:string} object but never leaks raw text to UI', () => {
    // Unrecognised plugin messages fall through to the generic fallback — never verbatim.
    expect(mapOAuthError({ message: 'native sign-in failed' }, null, en)).toBe(en.auth.oauthFailed)
  })

  it('coerces non-string message property to string then applies generic fallback', () => {
    expect(mapOAuthError({ message: 42 }, null, en)).toBe(en.auth.oauthFailed)
  })

  it('maps Android Google activity error to oauthFailed', () => {
    expect(mapOAuthError(new Error('Cannot use scopes without main activity'), null, en)).toBe(en.auth.oauthFailed)
    expect(mapOAuthError(new Error('no main activity found'), null, en)).toBe(en.auth.oauthFailed)
  })

  it('maps Apple invalid redirect error to oauthUnavailable', () => {
    expect(mapOAuthError(new Error('invalid_request: invalid web redirect url'), null, en)).toBe(en.auth.oauthUnavailable)
    expect(mapOAuthError(new Error('redirect_uri mismatch'), null, en)).toBe(en.auth.oauthUnavailable)
  })

  it('maps auth_timeout to oauthCancelled (cancellation is not a failure)', () => {
    expect(mapOAuthError(new Error('auth_timeout'), null, en)).toBe(en.auth.oauthCancelled)
  })

  it('maps no identity token error to oauthFailed', () => {
    expect(mapOAuthError(new Error('No identity token returned'), null, en)).toBe(en.auth.oauthFailed)
  })
})

describe('mapAuthError sign-in enumeration safety', () => {
  it('returns one identical message for wrong password, no account and unconfirmed', () => {
    const msgs = ['Invalid login credentials', 'invalid credentials', 'Email not confirmed'].map((m) => mapAuthError(new Error(m), 'signin', en))
    expect(new Set(msgs)).toEqual(new Set([en.auth.errorBadPassword]))
    expect(en.auth.errorBadPassword).toBe('Email or password is incorrect, or the email is not confirmed yet. Check your inbox or reset your password.')
  })
})

describe('resend neutrality', () => {
  it('unknown-account OTP errors are detected and never mapped to account wording', () => {
    const err = new Error('Signups not allowed for otp')
    expect(isUnknownAccountOtpError(err)).toBe(true)
    expect(isUnknownAccountOtpError({ message: 'User not found' })).toBe(true)
    expect(isUnknownAccountOtpError(new Error('Failed to fetch'))).toBe(false)
    expect(mapAuthError(err, 'resend', en).toLowerCase()).not.toMatch(/no account|not found|exist/)
  })
})
