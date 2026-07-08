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

const NATIVE_AUTH_TIMEOUT_MS = 60_000

/**
 * Cleanup-only backstop so a wedged `SocialLogin.login()` promise can't leak
 * forever. This is invisible: the UI spinner is cleared much earlier (10s) by
 * the caller (`useOAuthSignIn`). Resolving cancel here is never surfaced as an
 * error. We do NOT try to detect cancel from app-resume — after account
 * selection the app also returns to the foreground while the token is still
 * being fetched, so "resumed + still loading" is indistinguishable from a real
 * in-progress sign-in. The only trustworthy cancel signal is the plugin's own
 * rejection (see isCancellation) or an explicit user abort (AbortSignal).
 */
function withTimeout<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  const races: Promise<T>[] = [
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('auth_timeout')), NATIVE_AUTH_TIMEOUT_MS),
    ),
  ]
  // Settle immediately on user abort (back-button) so a wedged native login
  // promise — e.g. Android-Apple's broadcast-channel flow that never rejects on
  // dismiss — can't leave our flow pending and block the next attempt.
  if (signal) {
    races.push(
      new Promise<never>((_, reject) => {
        if (signal.aborted) reject(new Error('aborted'))
        else signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      }),
    )
  }
  return Promise.race(races)
}

/**
 * True when the plugin's rejection means the user dismissed the native UI.
 * capgo surfaces cancel differently per platform/provider, so match broadly:
 * iOS ASAuthorization (1001), Android Google legacy (12501), Android Credential
 * Manager (GetCredentialCancellationException / "activity is cancelled" /
 * "user canceled"), iOS ASWebAuthenticationSession canceled-login, plus our own
 * `auth_timeout` cleanup sentinel.
 */
function isCancellation(e: unknown): boolean {
  const m = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase()
  return (
    m.includes('cancel') || // cancel / canceled / cancelled / CancellationException / CanceledLogin
    m.includes('1001') ||
    m.includes('12501') ||
    m.includes('auth_timeout') ||
    m.includes('aborted')
  )
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
export async function nativeSocialSignIn(
  provider: OAuthProvider,
  signal?: AbortSignal,
): Promise<NativeSignInResult> {
  try {
    await ensureInit()
    const { SocialLogin } = await import('@capgo/capacitor-social-login')

    let idToken: string | null = null
    let googleRawNonce: string | undefined
    if (provider === 'apple') {
      // ponytail: best-effort reset before Android-Apple's broadcast-channel
      // flow so a channel left open by a dismissed prior attempt doesn't collide
      // and wedge the retry. Ignored where logout is a no-op / not logged in.
      if (isAndroid()) {
        try {
          await SocialLogin.logout?.({ provider: 'apple' })
        } catch {
          /* best-effort: no prior session / not implemented */
        }
      }
      const { result } = await withTimeout(SocialLogin.login({
        provider: 'apple',
        options: isAndroid()
          ? { scopes: ['name', 'email'], useBroadcastChannel: true }
          : { scopes: ['name', 'email'] },
      }), signal)
      idToken = result.idToken
    } else if (isAndroid()) {
      // Android: generate a nonce pair so Google embeds it in the ID token and
      // Supabase can verify it. Credential Manager mints a fresh token per login,
      // so the nonce always round-trips. Never pass `scopes` — email/profile/
      // openid are the plugin's defaults, and passing ANY scopes array makes
      // capgo's GoogleProvider demand a ModifiedMainActivityForSocialLoginPlugin
      // and reject the call.
      const bytes = new Uint8Array(32)
      crypto.getRandomValues(bytes)
      googleRawNonce = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(googleRawNonce))
      const hashedNonce = Array.from(new Uint8Array(hashBuf), b => b.toString(16).padStart(2, '0')).join('')

      const { result } = await withTimeout(SocialLogin.login({
        provider: 'google',
        options: { nonce: hashedNonce },
      }), signal)
      idToken = 'idToken' in result ? result.idToken : null
    } else {
      // iOS: NO nonce — capgo's GoogleProvider short-circuits to
      // restorePreviousSignIn whenever GIDSignIn has a cached user, and the
      // refreshed ID token retains the nonce claim minted by an older nonce-flow
      // build; sending no nonce to Supabase then fails with "Passed nonce and
      // nonce in id_token should either both exist or not". forcePrompt:true is
      // the deterministic fix: capgo's login gate is `hasPreviousSignIn() &&
      // !forceAuthCode`, so this bypasses restore and always mints a FRESH
      // interactive token with no nonce claim — matching our no-nonce exchange.
      // (Not in capgo's TS type but read by the native GoogleProvider payload.)
      const { result } = await withTimeout(SocialLogin.login({
        provider: 'google',
        options: { scopes: ['profile', 'email'], forcePrompt: true } as { scopes: string[] },
      }), signal)
      idToken = 'idToken' in result ? result.idToken : null
    }

    // The user tapped cancel while the native sheet was up — abort before we
    // exchange the token, so a completing flow doesn't sign them in post-cancel.
    if (signal?.aborted) return { error: null, cancelled: true, user: null }

    if (!idToken)
      return { error: { message: 'No identity token returned' }, cancelled: false, user: null }

    const supabase: SupabaseClient = createClient()
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider,
      token: idToken,
      ...(googleRawNonce ? { nonce: googleRawNonce } : {}),
    })
    // Surface the exact GoTrue rejection (audience/nonce/config) so an iOS
    // "provider didn't work" can be pinned from a device remote-inspector.
    if (error) console.warn(`[oauth] signInWithIdToken(${provider}) rejected:`, error.message)
    return {
      error: error ? { message: error.message } : null,
      cancelled: false,
      user: data?.user ?? null,
    }
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : String(e)
    // Surface capgo's exact rejection string so we can confirm/extend cancel
    // matching from a device remote-inspector session.
    console.warn('[oauth] login rejected:', message)
    if (isCancellation(e)) return { error: null, cancelled: true, user: null }
    return { error: { message }, cancelled: false, user: null }
  }
}
