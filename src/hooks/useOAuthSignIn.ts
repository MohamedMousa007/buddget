'use client'

import { useCallback, useState } from 'react'
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
export function useOAuthSignIn(nextPath: string) {
  const t = useT()
  const router = useRouter()
  const [pending, setPending] = useState<OAuthProvider | null>(null)
  const [error, setError] = useState('')

  const signIn = useCallback(
    async (provider: OAuthProvider) => {
      if (!isOAuthProviderEnabled(provider)) return
      setPending(provider)
      setError('')
      // The web-redirect (signInWithOAuth → /auth/callback) flow is unrecoverable
      // inside the native WebView: the PKCE verifier lives in the app's
      // https://localhost storage but the callback runs server-side on the
      // deployed origin (cookies) → "missing initial state". In the native bundle
      // we must ALWAYS use native sign-in and never fall through to web redirect.
      const native = isNativeShellBuild() || isNative()
      try {
        if (native) {
          const { nativeSocialSignIn, isNativeGoogleConfigured } = await import(
            '@/lib/native/socialSignIn'
          )
          if (provider === 'apple' || isNativeGoogleConfigured()) {
            const { error: e, cancelled } = await nativeSocialSignIn(provider)
            if (cancelled) {
              setError(mapOAuthError(null, 'cancelled', t))
              setPending(null)
              return
            }
            if (e) {
              setError(mapOAuthError(e, null, t))
              setPending(null)
              return
            }
            // onAuthStateChange closes the modal; we route here since native
            // sign-in never triggers a server-side middleware redirect.
            navigateAfterAuth(router, nextPath)
            setPending(null)
            return
          }
          // Native but provider unusable natively — surface friendly copy rather
          // than falling to the broken web-redirect flow.
          setError(mapOAuthError({ message: 'no identity token' }, null, t))
          setPending(null)
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
        setError(mapOAuthError(e, null, t))
        setPending(null)
      }
    },
    [nextPath, t, router],
  )

  return {
    pending,
    error,
    signIn,
    isGoogleEnabled: isOAuthProviderEnabled('google'),
    isAppleEnabled: isOAuthProviderEnabled('apple'),
  }
}
