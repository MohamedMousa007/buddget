'use client'

import { useCallback, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { APP_CONFIG } from '@/lib/config'
import { useT } from '@/lib/i18n'
import { useAuth } from '@/components/auth/auth-context'

/**
 * Google + Apple sign-in buttons for the auth modal and the landing page.
 *
 * Wires Supabase's `signInWithOAuth` with a redirectTo that matches our
 * `/auth/callback` handler. The handler lives at `src/app/auth/callback/route.ts`
 * and already takes care of exchanging the code for a session + routing the
 * user to `?next=...` when present.
 *
 * Provider setup lives in the Supabase dashboard (Auth → Providers); this
 * component is a no-op when the provider isn't configured (Supabase returns
 * an error which we surface inline).
 */
export function AuthOAuthButtons({ nextPath }: { nextPath: string }) {
  const t = useT()
  const { authModalMessage } = useAuth()
  const [pending, setPending] = useState<'google' | 'apple' | null>(null)
  const [error, setError] = useState<string>('')

  const sign = useCallback(
    async (provider: 'google' | 'apple') => {
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
          setError(e.message || t.auth.oauthUnavailable)
          setPending(null)
        }
        // On success the browser navigates to the provider; no return here.
      } catch (e) {
        setError((e as Error).message || t.auth.oauthUnavailable)
        setPending(null)
      }
    },
    [nextPath, t.auth.oauthUnavailable],
  )

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => void sign('google')}
        className="w-full h-11 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors text-[var(--color-brand-text-primary)] border-[var(--color-brand-border)] bg-[var(--color-brand-card)] hover:bg-[var(--color-brand-elevated)] disabled:opacity-60"
        aria-label={t.auth.continueWithGoogle}
      >
        {pending === 'google' ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
        ) : (
          <GoogleGlyph />
        )}
        <span>{t.auth.continueWithGoogle}</span>
      </button>
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => void sign('apple')}
        className="w-full h-11 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors text-white bg-black hover:bg-black/90 disabled:opacity-60"
        aria-label={t.auth.continueWithApple}
      >
        {pending === 'apple' ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
        ) : (
          <AppleGlyph />
        )}
        <span>{t.auth.continueWithApple}</span>
      </button>
      {error ? (
        <p className="text-[12px] text-[var(--color-brand-red)] text-center" role="alert">
          {error}
        </p>
      ) : null}
      {authModalMessage ? null : null /* placeholder to keep message in parent */}
    </div>
  )
}

/** Multi-colour "G" mark rendered in SVG so we don't ship Google's PNG. */
function GoogleGlyph() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

function AppleGlyph() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 384 512" aria-hidden fill="currentColor">
      <path d="M318.7 268.7c-.3-36.7 16.4-64.4 50.1-84.8-18.9-27-47.4-41.9-85-44.8-35.6-2.8-74.5 20.7-88.7 20.7-15.1 0-49.5-19.7-76.6-19.2C69.3 141.2 8 189.2 8 287.4c0 29 5.3 59 15.9 90 14.2 40.6 65.4 140.2 118.8 138.6 27.9-.7 47.6-19.8 83.8-19.8 35.2 0 53.4 19.8 84.3 19.8 54 .8 100.3-110.8 113.7-151.6-72.6-34.2-105.8-100.7-105.8-95.7zM256 74.1c26.7-31.7 24.3-60.5 23.5-71.1-23.6 1.4-50.9 16.1-66.5 34.2-17.2 19.3-27.3 43.3-25.1 70.5 25.5 1.9 48.8-11.2 68.1-33.6z" />
    </svg>
  )
}
