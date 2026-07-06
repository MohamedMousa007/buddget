'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { APP_CONFIG } from '@/lib/config'
import { appOrigin } from '@/lib/apiBase'
import { mapOAuthError } from '@/components/auth/authErrors'
import { isOAuthProviderEnabled, type OAuthProvider } from '@/lib/auth/oauthProviders'
import { navigateAfterAuth } from '@/lib/auth/postAuthRedirect'
import { useT } from '@/lib/i18n'
import { isNative, isNativeShellBuild } from '@/lib/native/isNative'

/**
 * Supabase OAuth sign-in for Google / Apple. Returns per-provider availability
 * from `NEXT_PUBLIC_OAUTH_*` so UI can disable unconfigured providers.
 *
 * Native (Capacitor) uses fully in-app native sign-in (`signInWithIdToken`) so
 * the user never leaves the app. Web uses the standard redirect flow. Native
 * Google falls back to the redirect flow until its iOS client ID is provisioned.
 */
const CAN_CANCEL_FALLBACK_MS = 3_000
const SPINNER_BACKSTOP_MS = 10_000

export function useOAuthSignIn(nextPath: string) {
  const t = useT()
  const router = useRouter()
  const [pending, setPending] = useState<OAuthProvider | null>(null)
  const [error, setError] = useState('')
  // True once the user is back in the app (or after a fallback delay) so the
  // loading button can be tapped to abort a hung native flow.
  const [canCancel, setCanCancel] = useState(false)
  // Bumped on every new attempt and on cancel; a stale continuation compares its
  // captured value and bails so it can't navigate/error after being superseded.
  const genRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  /** User tapped the loading button — hard-abort: stop the Supabase exchange if
   *  it hasn't started. A flow that already finished still lands via
   *  onAuthStateChange (they completed it), which is correct. */
  const cancelSignIn = useCallback(() => {
    genRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    setPending(null)
    setCanCancel(false)
  }, [])

  const signIn = useCallback(
    async (provider: OAuthProvider) => {
      if (!isOAuthProviderEnabled(provider)) return
      // Supersede any in-flight attempt so its exchange can't complete.
      abortRef.current?.abort()
      const gen = ++genRef.current
      const controller = new AbortController()
      abortRef.current = controller
      setPending(provider)
      setError('')
      setCanCancel(false)

      // The web-redirect (signInWithOAuth → /auth/callback) flow is unrecoverable
      // inside the native WebView: the PKCE verifier lives in the app's
      // https://localhost storage but the callback runs server-side on the
      // deployed origin (cookies) → "missing initial state". In the native bundle
      // we must ALWAYS use native sign-in and never fall through to web redirect.
      const native = isNativeShellBuild() || isNative()

      // Native escape hatches while the native sheet is up. NOTE: the 10s
      // backstop clears the SPINNER only — it must not abort or bump gen, so a
      // slow-but-real sign-in still completes and onAuthStateChange signs them in.
      let fallbackTimer: ReturnType<typeof setTimeout> | undefined
      let backstopTimer: ReturnType<typeof setTimeout> | undefined
      let appListener: { remove(): Promise<void> } | undefined
      const cleanup = () => {
        if (fallbackTimer) clearTimeout(fallbackTimer)
        if (backstopTimer) clearTimeout(backstopTimer)
        void appListener?.remove().catch(() => {})
      }
      if (native) {
        fallbackTimer = setTimeout(() => {
          if (genRef.current === gen) setCanCancel(true)
        }, CAN_CANCEL_FALLBACK_MS)
        backstopTimer = setTimeout(() => {
          if (genRef.current === gen) {
            setPending(null)
            setCanCancel(false)
          }
        }, SPINNER_BACKSTOP_MS)
        void import('@capacitor/app')
          .then(({ App }) =>
            App.addListener('appStateChange', ({ isActive }) => {
              if (isActive && genRef.current === gen) setCanCancel(true)
            }),
          )
          .then((h) => {
            appListener = h
          })
          .catch(() => {})
      }

      try {
        if (native) {
          const { nativeSocialSignIn, isNativeGoogleConfigured } = await import(
            '@/lib/native/socialSignIn'
          )
          if (provider === 'apple' || isNativeGoogleConfigured()) {
            const { error: e, cancelled } = await nativeSocialSignIn(provider, controller.signal)
            // Superseded or cancelled by the user — leave state to that path.
            if (genRef.current !== gen) return
            if (cancelled) {
              // User backed out — reset silently; a cancel is not an error.
              setPending(null)
              setCanCancel(false)
              return
            }
            if (e) {
              setError(mapOAuthError(e, null, t))
              setPending(null)
              setCanCancel(false)
              return
            }
            // onAuthStateChange closes the modal; we route here since native
            // sign-in never triggers a server-side middleware redirect.
            navigateAfterAuth(router, nextPath)
            setPending(null)
            setCanCancel(false)
            return
          }
          // Native but provider unusable natively — surface friendly copy rather
          // than falling to the broken web-redirect flow.
          setError(mapOAuthError({ message: 'no identity token' }, null, t))
          setPending(null)
          setCanCancel(false)
          return
        }

        // Web / PWA only — never reached in the native bundle.
        const supabase = createClient()
        const origin = appOrigin() || APP_CONFIG.url.replace(/\/$/, '')
        const next = nextPath && nextPath.startsWith('/') ? nextPath : '/'
        const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`
        const { error: e } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo },
        })
        if (e) {
          setError(mapOAuthError(e, null, t))
          setPending(null)
        }
      } catch (e) {
        if (genRef.current !== gen) return
        setError(mapOAuthError(e, null, t))
        setPending(null)
        setCanCancel(false)
      } finally {
        cleanup()
      }
    },
    [nextPath, t, router],
  )

  return {
    pending,
    error,
    canCancel,
    signIn,
    cancelSignIn,
    isGoogleEnabled: isOAuthProviderEnabled('google'),
    isAppleEnabled: isOAuthProviderEnabled('apple'),
  }
}
