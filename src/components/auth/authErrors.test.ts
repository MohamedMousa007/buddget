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

  it('returns failed copy for exchange errors', () => {
    expect(mapOAuthError(null, 'exchange_failed', en)).toBe(en.auth.oauthFailed)
  })

  it('maps provider-not-enabled messages', () => {
    expect(mapOAuthError(new Error('Provider is not enabled'), null, en)).toBe(
      en.auth.oauthUnavailable,
    )
  })
})
