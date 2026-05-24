import { describe, expect, it, afterEach } from 'vitest'
import {
  enabledOAuthProviders,
  hasAnyOAuthProvider,
  isOAuthProviderEnabled,
} from '@/lib/auth/oauthProviders'

describe('oauthProviders', () => {
  const prevGoogle = process.env.NEXT_PUBLIC_OAUTH_GOOGLE
  const prevApple = process.env.NEXT_PUBLIC_OAUTH_APPLE

  afterEach(() => {
    process.env.NEXT_PUBLIC_OAUTH_GOOGLE = prevGoogle
    process.env.NEXT_PUBLIC_OAUTH_APPLE = prevApple
  })

  it('treats true and 1 as enabled', () => {
    process.env.NEXT_PUBLIC_OAUTH_GOOGLE = 'true'
    process.env.NEXT_PUBLIC_OAUTH_APPLE = '1'
    expect(isOAuthProviderEnabled('google')).toBe(true)
    expect(isOAuthProviderEnabled('apple')).toBe(true)
    expect(enabledOAuthProviders()).toEqual(['google', 'apple'])
    expect(hasAnyOAuthProvider()).toBe(true)
  })

  it('defaults to disabled when unset', () => {
    delete process.env.NEXT_PUBLIC_OAUTH_GOOGLE
    delete process.env.NEXT_PUBLIC_OAUTH_APPLE
    expect(hasAnyOAuthProvider()).toBe(false)
  })
})
