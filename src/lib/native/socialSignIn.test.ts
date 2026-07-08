/**
 * Tests for native Apple + Google sign-in (iOS and Android).
 *
 * Key bugs covered:
 * - Android: Apple init config MUST include `redirectUrl` — without it the Java
 *   plugin early-returns before Google is initialised, breaking BOTH providers.
 * - Error objects from capgo are plain `{ message: string }`, not Error instances;
 *   the outer catch must not fall through to String(err) = "[object Object]".
 * - `initPromise` is module-level; failed init must reset it so a later call retries.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Stable mock handles — created via vi.hoisted so they're available inside the
// vi.mock() factory closures (which run before module-level const declarations).
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  isAndroid: vi.fn<[], boolean>(() => false),
  initialize: vi.fn<[], Promise<void>>(() => Promise.resolve()),
  login: vi.fn(),
  logout: vi.fn(() => Promise.resolve()),
  signInWithIdToken: vi.fn(() => Promise.resolve({ error: null })),
  // Capture the args SocialLogin.initialize is called with, per test.
  lastInitArgs: null as Parameters<typeof import('@capgo/capacitor-social-login').SocialLogin.initialize>[0] | null,
}))

vi.mock('@/lib/native/isNative', () => ({
  isAndroid: mocks.isAndroid,
  isNative: vi.fn(() => true),
}))

vi.mock('@capgo/capacitor-social-login', () => ({
  SocialLogin: {
    initialize: async (...args: Parameters<typeof import('@capgo/capacitor-social-login').SocialLogin.initialize>) => {
      mocks.lastInitArgs = args[0]
      return mocks.initialize(...args)
    },
    login: (...args: unknown[]) => mocks.login(...args),
    logout: (...args: unknown[]) => mocks.logout(...args),
  },
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: { signInWithIdToken: mocks.signInWithIdToken },
  })),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type SocialSignInModule = typeof import('@/lib/native/socialSignIn')

/** Returns a fresh module instance — resets the `initPromise` singleton. */
async function freshModule(opts: {
  android?: boolean
  googleIosClientId?: string
  googleWebClientId?: string
  appleServicesId?: string
} = {}): Promise<SocialSignInModule> {
  vi.resetModules()
  mocks.isAndroid.mockReturnValue(opts.android ?? false)
  if (opts.googleIosClientId !== undefined)
    process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID = opts.googleIosClientId
  else
    delete process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID
  if (opts.googleWebClientId !== undefined)
    process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID = opts.googleWebClientId
  else
    delete process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID
  if (opts.appleServicesId !== undefined)
    process.env.NEXT_PUBLIC_APPLE_SERVICES_ID = opts.appleServicesId
  else
    delete process.env.NEXT_PUBLIC_APPLE_SERVICES_ID
  return import('@/lib/native/socialSignIn')
}

const CAPGO_REDIRECT_URL = 'https://capacitor-social-login.firebaseapp.com/__/auth/handler'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.lastInitArgs = null
  mocks.isAndroid.mockReturnValue(false)
  mocks.initialize.mockResolvedValue(undefined)
  mocks.login.mockResolvedValue({ result: { idToken: 'id-token-ios' } })
  mocks.signInWithIdToken.mockResolvedValue({ error: null })
})

// ---------------------------------------------------------------------------
// isNativeGoogleConfigured
// ---------------------------------------------------------------------------
describe('isNativeGoogleConfigured', () => {
  it('returns false on iOS when GOOGLE_IOS_CLIENT_ID is unset', async () => {
    const { isNativeGoogleConfigured } = await freshModule({ android: false })
    expect(isNativeGoogleConfigured()).toBe(false)
  })

  it('returns true on iOS when GOOGLE_IOS_CLIENT_ID is set', async () => {
    const { isNativeGoogleConfigured } = await freshModule({
      android: false,
      googleIosClientId: 'ios-client.apps.googleusercontent.com',
    })
    expect(isNativeGoogleConfigured()).toBe(true)
  })

  it('returns false on Android when GOOGLE_WEB_CLIENT_ID is unset', async () => {
    const { isNativeGoogleConfigured } = await freshModule({ android: true })
    expect(isNativeGoogleConfigured()).toBe(false)
  })

  it('returns true on Android when GOOGLE_WEB_CLIENT_ID is set', async () => {
    const { isNativeGoogleConfigured } = await freshModule({
      android: true,
      googleWebClientId: 'web-client.apps.googleusercontent.com',
    })
    expect(isNativeGoogleConfigured()).toBe(true)
  })

  it('iOS client ID does not satisfy Android requirement', async () => {
    // iOS ID set but Android platform — still false because Android needs WEB_CLIENT_ID
    const { isNativeGoogleConfigured } = await freshModule({
      android: true,
      googleIosClientId: 'ios-client.apps.googleusercontent.com',
    })
    expect(isNativeGoogleConfigured()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SocialLogin.initialize — platform-specific Apple config
// ---------------------------------------------------------------------------
describe('ensureInit — Apple config on Android (the redirectUrl bug fix)', () => {
  it('passes redirectUrl in Apple config on Android', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: true, appleServicesId: 'app.test.service' })
    await nativeSocialSignIn('apple')
    const apple = mocks.lastInitArgs?.apple as Record<string, unknown> | undefined
    expect(apple).toBeDefined()
    expect(apple?.redirectUrl).toBe(CAPGO_REDIRECT_URL)
  })

  it('sets useBroadcastChannel:true in Apple config on Android', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: true })
    await nativeSocialSignIn('apple')
    const apple = mocks.lastInitArgs?.apple as Record<string, unknown> | undefined
    expect(apple?.useBroadcastChannel).toBe(true)
  })

  it('uses APPLE_SERVICES_ID as clientId in Apple config on Android', async () => {
    const { nativeSocialSignIn } = await freshModule({
      android: true,
      appleServicesId: 'custom.services.id',
    })
    await nativeSocialSignIn('apple')
    const apple = mocks.lastInitArgs?.apple as Record<string, unknown> | undefined
    expect(apple?.clientId).toBe('custom.services.id')
  })

  it('falls back to default APPLE_SERVICES_ID when env var unset', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: true })
    await nativeSocialSignIn('apple')
    const apple = mocks.lastInitArgs?.apple as Record<string, unknown> | undefined
    expect(apple?.clientId).toBe('app.buddget.web.service')
  })

  it('does NOT pass apple config on iOS (native ASAuthorization needs no clientId)', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    await nativeSocialSignIn('apple')
    // On iOS the apple spread is an empty object — no clientId, no redirectUrl
    const apple = mocks.lastInitArgs?.apple as Record<string, unknown> | undefined
    if (apple) {
      expect(apple.clientId).toBeUndefined()
      expect(apple.redirectUrl).toBeUndefined()
    }
  })
})

describe('ensureInit — Google config', () => {
  it('passes both iOS and Web client IDs when configured', async () => {
    const { nativeSocialSignIn } = await freshModule({
      android: false,
      googleIosClientId: 'ios.id',
      googleWebClientId: 'web.id',
    })
    await nativeSocialSignIn('google')
    const google = mocks.lastInitArgs?.google as Record<string, unknown> | undefined
    expect(google?.iOSClientId).toBe('ios.id')
    expect(google?.webClientId).toBe('web.id')
  })

  it('omits google key entirely when neither client ID is set', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    await nativeSocialSignIn('google')
    expect(mocks.lastInitArgs?.google).toBeUndefined()
  })
})

describe('ensureInit — one-shot caching', () => {
  it('calls SocialLogin.initialize exactly once across multiple sign-in calls', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    await nativeSocialSignIn('apple')
    await nativeSocialSignIn('google')
    await nativeSocialSignIn('apple')
    expect(mocks.initialize).toHaveBeenCalledTimes(1)
  })

  it('resets initPromise on failure so the next call retries', async () => {
    mocks.initialize.mockRejectedValueOnce(new Error('init failed'))
    const { nativeSocialSignIn } = await freshModule({ android: false })

    const first = await nativeSocialSignIn('apple')
    expect(first.error?.message).toContain('init failed')

    // Second call must retry initialize (initPromise was reset)
    mocks.initialize.mockResolvedValue(undefined)
    await nativeSocialSignIn('apple')
    expect(mocks.initialize).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// nativeSocialSignIn — Apple
// ---------------------------------------------------------------------------
describe('nativeSocialSignIn — Apple — iOS', () => {
  it('returns {error:null,cancelled:false} on success', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    mocks.login.mockResolvedValueOnce({ result: { idToken: 'apple-ios-token' } })
    mocks.signInWithIdToken.mockResolvedValueOnce({ error: null })
    const result = await nativeSocialSignIn('apple')
    expect(result).toEqual({ error: null, cancelled: false, user: null })
  })

  it('returns the user from signInWithIdToken for post-auth routing (no getSession)', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    mocks.login.mockResolvedValueOnce({ result: { idToken: 'apple-ios-token' } })
    mocks.signInWithIdToken.mockResolvedValueOnce({
      data: { user: { id: 'u_123' } },
      error: null,
    })
    const result = await nativeSocialSignIn('apple')
    expect(result.user).toEqual({ id: 'u_123' })
    expect(result.error).toBeNull()
  })

  it('passes the idToken to supabase.auth.signInWithIdToken with provider=apple', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    mocks.login.mockResolvedValueOnce({ result: { idToken: 'apple-ios-token' } })
    await nativeSocialSignIn('apple')
    expect(mocks.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-ios-token',
    })
  })

  it('returns {error:null,cancelled:true} when user cancels (message includes "cancel")', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    mocks.login.mockRejectedValueOnce(new Error('User cancelled the sign-in'))
    const result = await nativeSocialSignIn('apple')
    expect(result).toEqual({ error: null, cancelled: true, user: null })
  })

  it('returns {error:null,cancelled:true} when user cancels with code 1001', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    mocks.login.mockRejectedValueOnce(new Error('Error 1001: user dismissed'))
    const result = await nativeSocialSignIn('apple')
    expect(result).toEqual({ error: null, cancelled: true, user: null })
  })

  it('returns error when login throws a non-cancel error', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    mocks.login.mockRejectedValueOnce(new Error('Network unavailable'))
    const result = await nativeSocialSignIn('apple')
    expect(result.cancelled).toBe(false)
    expect(result.error?.message).toBe('Network unavailable')
  })

  it('returns error when no idToken is returned', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    mocks.login.mockResolvedValueOnce({ result: { idToken: null } })
    const result = await nativeSocialSignIn('apple')
    expect(result.error?.message).toBe('No identity token returned')
    expect(result.cancelled).toBe(false)
  })

  it('returns supabase error message when signInWithIdToken fails', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    mocks.login.mockResolvedValueOnce({ result: { idToken: 'token' } })
    mocks.signInWithIdToken.mockResolvedValueOnce({ error: { message: 'Invalid JWT' } })
    const result = await nativeSocialSignIn('apple')
    expect(result.error?.message).toBe('Invalid JWT')
    expect(result.cancelled).toBe(false)
  })

  it('plain {message:string} error from capgo is not "[object Object]"', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    // capgo returns plain objects, not Error instances
    mocks.login.mockRejectedValueOnce({ message: 'SocialLoginError: auth failed' })
    const result = await nativeSocialSignIn('apple')
    // Must NOT produce "[object Object]"
    expect(result.error?.message).not.toBe('[object Object]')
    expect(result.cancelled).toBe(false)
  })
})

describe('nativeSocialSignIn — Apple — Android', () => {
  it('returns {error:null,cancelled:false} on success', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: true })
    mocks.login.mockResolvedValueOnce({ result: { idToken: 'apple-android-token' } })
    mocks.signInWithIdToken.mockResolvedValueOnce({ error: null })
    const result = await nativeSocialSignIn('apple')
    expect(result).toEqual({ error: null, cancelled: false, user: null })
  })

  it('calls login with useBroadcastChannel:true on Android', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: true })
    await nativeSocialSignIn('apple')
    expect(mocks.login).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'apple',
        options: expect.objectContaining({ useBroadcastChannel: true }),
      }),
    )
  })

  it('returns {error:null,cancelled:true} when user cancels', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: true })
    mocks.login.mockRejectedValueOnce(new Error('User cancelled'))
    const result = await nativeSocialSignIn('apple')
    expect(result).toEqual({ error: null, cancelled: true, user: null })
  })

  it('returns error when login throws non-cancel (plain object from capgo)', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: true })
    mocks.login.mockRejectedValueOnce({ message: 'redirect_uri_mismatch' })
    const result = await nativeSocialSignIn('apple')
    expect(result.error?.message).not.toBe('[object Object]')
    expect(result.cancelled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// nativeSocialSignIn — Google
// ---------------------------------------------------------------------------
describe('nativeSocialSignIn — Google — iOS', () => {
  it('returns {error:null,cancelled:false} on success', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    mocks.login.mockResolvedValueOnce({ result: { idToken: 'google-ios-token' } })
    const result = await nativeSocialSignIn('google')
    expect(result).toEqual({ error: null, cancelled: false, user: null })
  })

  it('forwards a matching nonce to supabase and forces a fresh sign-in', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    mocks.login.mockResolvedValueOnce({ result: { idToken: 'g-ios-token' } })
    await nativeSocialSignIn('google')
    // Raw nonce is forwarded to Supabase; the hashed one is embedded via capgo.
    const exchange = mocks.signInWithIdToken.mock.calls[0][0] as Record<string, unknown>
    expect(exchange.provider).toBe('google')
    expect(exchange.token).toBe('g-ios-token')
    expect(exchange.nonce).toEqual(expect.any(String))
    const arg = mocks.login.mock.calls[0][0] as { options: Record<string, unknown> }
    expect(arg.options.nonce).toEqual(expect.any(String))
    // forcePrompt bypasses capgo's restore gate; logout clears the stale
    // nonce-bearing keychain credential so restore can't serve it.
    expect(arg.options.forcePrompt).toBe(true)
    expect(mocks.logout).toHaveBeenCalledWith({ provider: 'google' })
  })

  it('returns {error:null,cancelled:true} when user cancels', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    mocks.login.mockRejectedValueOnce(new Error('sign_in_cancelled'))
    const result = await nativeSocialSignIn('google')
    expect(result).toEqual({ error: null, cancelled: true, user: null })
  })

  it('handles idToken in result when login result uses {idToken} shape', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    // Google result may use {idToken:...} directly (not nested under result.result)
    mocks.login.mockResolvedValueOnce({ result: { idToken: 'direct-token' } })
    const result = await nativeSocialSignIn('google')
    expect(result.error).toBeNull()
  })

  it('returns "No identity token" when result has no idToken property', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    // Google result without idToken key (provider not configured for native)
    mocks.login.mockResolvedValueOnce({ result: {} })
    const result = await nativeSocialSignIn('google')
    expect(result.error?.message).toBe('No identity token returned')
  })

  it('returns supabase error when signInWithIdToken fails', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    mocks.login.mockResolvedValueOnce({ result: { idToken: 'token' } })
    mocks.signInWithIdToken.mockResolvedValueOnce({ error: { message: 'provider disabled' } })
    const result = await nativeSocialSignIn('google')
    expect(result.error?.message).toBe('provider disabled')
  })
})

describe('nativeSocialSignIn — Google — Android', () => {
  it('returns {error:null,cancelled:false} on success', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: true })
    mocks.login.mockResolvedValueOnce({ result: { idToken: 'google-android-token' } })
    mocks.signInWithIdToken.mockResolvedValueOnce({ error: null })
    const result = await nativeSocialSignIn('google')
    expect(result).toEqual({ error: null, cancelled: false, user: null })
  })

  it('returns {error:null,cancelled:true} when user cancels', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: true })
    mocks.login.mockRejectedValueOnce(new Error('12501: cancelled by user'))
    const result = await nativeSocialSignIn('google')
    // 12501 is Google's "sign in cancelled" code — contains "cancel"
    expect(result.cancelled).toBe(true)
    expect(result.error).toBeNull()
  })

  it('returns error when both providers fail after missing redirectUrl would have caused (regression guard)', async () => {
    // This is the exact regression: on Android, if Apple's redirectUrl is missing,
    // the Java plugin's initialize() returns early → Google is never registered →
    // both Apple AND Google sign-in fail with "not initialized" errors.
    // The fix (supplying redirectUrl) means initialize() completes successfully.
    // We verify that after a successful init, Google sign-in reaches SocialLogin.login.
    const { nativeSocialSignIn } = await freshModule({ android: true })
    mocks.login.mockResolvedValueOnce({ result: { idToken: 'g-android-token' } })
    await nativeSocialSignIn('google')
    expect(mocks.login).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    )
  })
})

describe('nativeSocialSignIn — Google scopes per platform', () => {
  it('omits scopes on Android (capgo rejects any scopes without a modified MainActivity)', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: true })
    mocks.login.mockResolvedValueOnce({ result: { idToken: 't' } })
    await nativeSocialSignIn('google')
    const arg = mocks.login.mock.calls[0][0] as { options: Record<string, unknown> }
    expect(arg.options.scopes).toBeUndefined()
    expect(arg.options.nonce).toEqual(expect.any(String))
  })

  it('passes scopes and a hashed nonce on iOS', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    mocks.login.mockResolvedValueOnce({ result: { idToken: 't' } })
    await nativeSocialSignIn('google')
    const arg = mocks.login.mock.calls[0][0] as { options: Record<string, unknown> }
    expect(arg.options.scopes).toEqual(['profile', 'email'])
    expect(arg.options.nonce).toEqual(expect.any(String))
  })
})

// ---------------------------------------------------------------------------
// Abort (user tapped the loading button to cancel a hung flow)
// ---------------------------------------------------------------------------
describe('AbortSignal cancellation', () => {
  it('aborts before the Supabase exchange → cancelled, no signInWithIdToken', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    const controller = new AbortController()
    // Login resolves a token, but the signal is already aborted by the time we
    // check it (user tapped cancel while the sheet was up).
    mocks.login.mockImplementationOnce(() => {
      controller.abort()
      return Promise.resolve({ result: { idToken: 'tok' } })
    })
    const result = await nativeSocialSignIn('google', controller.signal)
    expect(result).toEqual({ error: null, cancelled: true, user: null })
    expect(mocks.signInWithIdToken).not.toHaveBeenCalled()
  })

  it('does not abort a normal flow when the signal stays clear', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    const controller = new AbortController()
    mocks.login.mockResolvedValueOnce({ result: { idToken: 'tok' } })
    const result = await nativeSocialSignIn('google', controller.signal)
    expect(result.cancelled).toBe(false)
    expect(mocks.signInWithIdToken).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// isCancellation — broadened per-platform cancel signatures
// ---------------------------------------------------------------------------
describe('cancellation detection', () => {
  const cancellationErrors = [
    'User cancelled the request', // generic
    'The operation was canceled', // US spelling
    'CANCEL',
    'Error 1001', // iOS ASAuthorization
    '12501: cancelled by user', // Android Google legacy
    'androidx.credentials.exceptions.GetCredentialCancellationException',
    'activity is cancelled by the user.',
    'ASWebAuthenticationSessionErrorCodeCanceledLogin',
  ]

  for (const msg of cancellationErrors) {
    it(`detects "${msg}" as cancellation`, async () => {
      const { nativeSocialSignIn } = await freshModule({ android: false })
      mocks.login.mockRejectedValueOnce(new Error(msg))
      const result = await nativeSocialSignIn('apple')
      expect(result).toEqual({ error: null, cancelled: true, user: null })
    })
  }

  it('does NOT treat a non-cancel error as cancellation', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    mocks.login.mockRejectedValueOnce(new Error('Network timeout'))
    const result = await nativeSocialSignIn('apple')
    expect(result.cancelled).toBe(false)
    expect(result.error).not.toBeNull()
  })

  it('a resolved login is never turned into a cancel', async () => {
    const { nativeSocialSignIn } = await freshModule({ android: false })
    mocks.login.mockResolvedValueOnce({ result: { idToken: 'real-token' } })
    mocks.signInWithIdToken.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    const result = await nativeSocialSignIn('google')
    expect(result.cancelled).toBe(false)
    expect(result.error).toBeNull()
    expect(result.user).toEqual({ id: 'u1' })
  })
})
