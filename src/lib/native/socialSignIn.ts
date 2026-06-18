import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { OAuthProvider } from '@/lib/auth/oauthProviders'

/**
 * Google client IDs are build-time inlined (`NEXT_PUBLIC_*`). Apple needs none
 * (it authenticates against the app's bundle ID). Until the Google iOS client
 * is provisioned, native Google falls back to the web-redirect flow.
 */
const GOOGLE_IOS_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined
const GOOGLE_WEB_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || undefined

/** True once the native Google iOS client ID is configured at build time. */
export function isNativeGoogleConfigured(): boolean {
  return Boolean(GOOGLE_IOS_CLIENT_ID)
}

/** One-shot cached initialize — calling `initialize` twice throws on native. */
let initPromise: Promise<void> | null = null
async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const { SocialLogin } = await import('@capgo/capacitor-social-login')
      await SocialLogin.initialize({
        apple: {},
        ...(GOOGLE_IOS_CLIENT_ID
          ? { google: { iOSClientId: GOOGLE_IOS_CLIENT_ID, webClientId: GOOGLE_WEB_CLIENT_ID } }
          : {}),
      })
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
}

/** iOS ASAuthorization / Google sign-in surface their cancel as code 1001 / "cancel". */
function isCancellation(e: unknown): boolean {
  const m = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase()
  return m.includes('cancel') || m.includes('1001')
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
    if (provider === 'apple') {
      const { result } = await SocialLogin.login({
        provider: 'apple',
        options: { scopes: ['name', 'email'] },
      })
      idToken = result.idToken
    } else {
      const { result } = await SocialLogin.login({
        provider: 'google',
        options: { scopes: ['profile', 'email'] },
      })
      idToken = 'idToken' in result ? result.idToken : null
    }

    if (!idToken) return { error: { message: 'No identity token returned' }, cancelled: false }

    const supabase: SupabaseClient = createClient()
    const { error } = await supabase.auth.signInWithIdToken({ provider, token: idToken })
    return { error: error ? { message: error.message } : null, cancelled: false }
  } catch (e) {
    if (isCancellation(e)) return { error: null, cancelled: true }
    return { error: { message: e instanceof Error ? e.message : String(e) }, cancelled: false }
  }
}
