import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { OAuthProvider } from '@/lib/auth/oauthProviders'
import { isAndroid } from '@/lib/native/isNative'

/**
 * Google client IDs are build-time inlined (`NEXT_PUBLIC_*`). Apple needs none
 * on iOS (it authenticates against the app's bundle ID).
 *
 * Google native sign-in uses different client IDs per platform: iOS needs the
 * iOS client ID, Android uses the Web client ID as its serverClientId (the
 * returned id token's audience is the Web client ID). Until the relevant client
 * is provisioned, native Google falls back to the web-redirect flow.
 */
const GOOGLE_IOS_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined
const GOOGLE_WEB_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || undefined

/**
 * Apple Services ID — required for Apple sign-in on Android (Apple has no native
 * Android SDK, so it runs as a web OAuth flow). iOS authenticates against the
 * bundle ID and needs no Services ID. The id token's `aud` is this Services ID,
 * which must be listed in Supabase's Apple "Client IDs".
 */
const APPLE_SERVICES_ID =
  process.env.NEXT_PUBLIC_APPLE_SERVICES_ID?.trim() || 'app.buddget.web.service'

/** True once the client ID this platform needs for native Google is configured. */
export function isNativeGoogleConfigured(): boolean {
  return isAndroid() ? Boolean(GOOGLE_WEB_CLIENT_ID) : Boolean(GOOGLE_IOS_CLIENT_ID)
}

/** One-shot cached initialize — calling `initialize` twice throws on native. */
let initPromise: Promise<void> | null = null
async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const { SocialLogin } = await import('@capgo/capacitor-social-login')
      const google =
        GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID
          ? { google: { iOSClientId: GOOGLE_IOS_CLIENT_ID, webClientId: GOOGLE_WEB_CLIENT_ID } }
          : {}
      // iOS Apple is fully native (no clientId/redirect). Android runs the web
      // OAuth flow via capgo's Broadcast Channel mode (no backend / redirect-URL
      // config of our own — capgo routes through its hosted handler, which is
      // registered as a Return URL on the Apple Services ID).
      // The Java plugin validates redirectUrl before checking useBroadcastChannel,
      // so we must supply it even in broadcast-channel mode (where the plugin
      // ignores it and uses the hardcoded Firebase handler URL instead).
      const apple = isAndroid()
        ? {
            clientId: APPLE_SERVICES_ID,
            useBroadcastChannel: true,
            redirectUrl: 'https://capacitor-social-login.firebaseapp.com/__/auth/handler',
          }
        : {}
      await SocialLogin.initialize({ apple, ...google })
    })().catch((e) => {
      initPromise = null // allow a later retry of a transient init failure
      throw e
    })
  }
  return initPromise
}

export interface NativeSignInResult {
  /** Non-null on a real failure (never logs or carries tokens). */
  error: { message: string } | null
  /** User dismissed the native sheet — surface friendly copy, not an error. */
  cancelled: boolean
  /** Authenticated user from the id-token exchange — used for routing without a getSession round-trip. */
  user: User | null
}

const NATIVE_AUTH_TIMEOUT_MS = 120_000

/** Race a login call against a 2-minute timeout so a hung promise (e.g. Apple
 *  BroadcastChannel tab closed via Android back) never leaves the spinner stuck. */
function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('auth_timeout')), NATIVE_AUTH_TIMEOUT_MS),
    ),
  ])
}

/** iOS ASAuthorization / Google sign-in surface their cancel as code 1001 / "cancel". */
function isCancellation(e: unknown): boolean {
  const m = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase()
  return m.includes('cancel') || m.includes('1001') || m.includes('auth_timeout')
}

/**
 * Fully native Apple / Google sign-in. Obtains an identity token from the OS
 * (Apple = native system sheet; Google = system auth sheet) and exchanges it
 * with Supabase via `signInWithIdToken` — the session lands directly in the app
 * with no browser hand-off and no deep-link round-trip.
 *
 * Nonce is intentionally omitted: capgo forwards the nonce to Apple UNHASHED
 * (`AppleProvider.swift` sets `request.nonce = nonce`), while Supabase expects
 * the token's `nonce` claim to be SHA-256 of the value passed to
 * `signInWithIdToken`. Reconciling the two is error-prone; omitting the nonce
 * is the supported, reliable path (the id token is short-lived + audience-bound).
 */
export async function nativeSocialSignIn(provider: OAuthProvider): Promise<NativeSignInResult> {
  try {
    await ensureInit()
    const { SocialLogin } = await import('@capgo/capacitor-social-login')

    let idToken: string | null = null
    let googleRawNonce: string | undefined
    if (provider === 'apple') {
      const { result } = await withTimeout(SocialLogin.login({
        provider: 'apple',
        options: isAndroid()
          ? { scopes: ['name', 'email'], useBroadcastChannel: true }
          : { scopes: ['name', 'email'] },
      }))
      idToken = result.idToken
    } else {
      // Generate a nonce pair so Google embeds it in the ID token and Supabase
      // can verify it. capgo passes hashedNonce as-is to GIDSignIn; Supabase
      // expects rawNonce and computes SHA-256 internally to match the token claim.
      const bytes = new Uint8Array(32)
      crypto.getRandomValues(bytes)
      googleRawNonce = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(googleRawNonce))
      const hashedNonce = Array.from(new Uint8Array(hashBuf), b => b.toString(16).padStart(2, '0')).join('')

      const { result } = await withTimeout(SocialLogin.login({
        provider: 'google',
        options: { scopes: ['profile', 'email'], nonce: hashedNonce },
      }))
      idToken = 'idToken' in result ? result.idToken : null
    }

    if (!idToken)
      return { error: { message: 'No identity token returned' }, cancelled: false, user: null }

    const supabase: SupabaseClient = createClient()
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider,
      token: idToken,
      ...(googleRawNonce ? { nonce: googleRawNonce } : {}),
    })
    return {
      error: error ? { message: error.message } : null,
      cancelled: false,
      user: data?.user ?? null,
    }
  } catch (e) {
    if (isCancellation(e)) return { error: null, cancelled: true, user: null }
    const message =
      e instanceof Error
        ? e.message
        : e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : String(e)
    return { error: { message }, cancelled: false, user: null }
  }
}
