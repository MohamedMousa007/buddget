'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { APP_CONFIG } from '@/lib/config'
import { mapOAuthError } from '@/components/auth/authErrors'
import { isOAuthProviderEnabled, type OAuthProvider } from '@/lib/auth/oauthProviders'
import { useT } from '@/lib/i18n'

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
        const origin =
          typeof window !== 'undefined' ? window.location.origin : APP_CONFIG.url.replace(/\/$/, '')
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
