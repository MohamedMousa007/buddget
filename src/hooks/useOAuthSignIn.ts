'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { APP_CONFIG } from '@/lib/config'
import { appOrigin } from '@/lib/apiBase'
import { mapOAuthError } from '@/components/auth/authErrors'
import { isOAuthProviderEnabled, type OAuthProvider } from '@/lib/auth/oauthProviders'
import { useT } from '@/lib/i18n'
import { isNative } from '@/lib/native/isNative'
import { NATIVE_AUTH_SCHEME } from '@/lib/native/nativeAuthScheme'

/**
 * Supabase OAuth sign-in for Google / Apple. Returns per-provider availability
 * from `NEXT_PUBLIC_OAUTH_*` so UI can disable unconfigured providers.
 */
export function useOAuthSignIn(nextPath: string) {
  const t = useT()
  const [pending, setPending] = useState<OAuthProvider | null>(null)
  const [error, setError] = useState('')

  const signIn = useCallback(
    async (provider: OAuthProvider) => {
      if (!isOAuthProviderEnabled(provider)) return
      setPending(provider)
      setError('')
      try {
        const supabase = createClient()
        const next = nextPath && nextPath.startsWith('/') ? nextPath : '/'

        if (isNative()) {
          // On native, redirect to the custom URL scheme so iOS intercepts the
          // callback. The server-side /auth/callback route uses a cookie-based
          // SSR Supabase client that has no access to the PKCE code verifier
          // stored in the native client's localStorage — exchange would fail.
          // skipBrowserRedirect keeps the main WebView on the app page so the
          // appUrlOpen listener (in AuthProvider) stays alive to handle the code.
          const redirectTo = `${NATIVE_AUTH_SCHEME}://auth/callback?next=${encodeURIComponent(next)}`
          const { data, error: e } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo, skipBrowserRedirect: true },
          })
          if (e) {
            setError(mapOAuthError(e, null, t))
            setPending(null)
            return
          }
          if (data.url) {
            const { Browser } = await import('@capacitor/browser')
            await Browser.open({ url: data.url, windowName: '_self' })
          }
        } else {
          const origin = appOrigin() || APP_CONFIG.url.replace(/\/$/, '')
          const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`
          const { error: e } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo },
          })
          if (e) {
            setError(mapOAuthError(e, null, t))
            setPending(null)
          }
        }
      } catch (e) {
        setError(mapOAuthError(e, null, t))
        setPending(null)
      }
    },
    [nextPath, t],
  )

  return {
    pending,
    error,
    signIn,
    isGoogleEnabled: isOAuthProviderEnabled('google'),
    isAppleEnabled: isOAuthProviderEnabled('apple'),
  }
}
