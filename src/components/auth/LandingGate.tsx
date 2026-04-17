'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-context'
import { AuthModalBody } from '@/components/features/auth-modal/AuthModalBody'
import { useT } from '@/lib/i18n'

/**
 * Pre-auth landing screen, rebuilt per user feedback. Mobile-first:
 *
 *  - Big branded logo at the top (the same "Buddget" wordmark used everywhere,
 *    just scaled up) with the tagline.
 *  - The regular sign-in / sign-up form rendered inline via the shared
 *    `AuthModalBody` — same component the overlay modal uses, so parity is
 *    automatic. Covers Google / Apple OAuth, password signin/up, OTP verify,
 *    forgot-password, strength meter, remember-me, 2FA.
 *  - A single "Continue as guest" CTA at the bottom for users who want to
 *    explore without committing an email.
 *
 * The overlay AuthModal is NOT rendered here — `AuthProvider` suppresses it
 * while mode === 'landing' because `showAuthModal` requires `authModalOpen`
 * which the landing never sets. Users who want OAuth or signup just tap the
 * inline form.
 */
export function LandingGate() {
  const t = useT()
  const { startGuest } = useAuth()
  const [guestPending, setGuestPending] = useState(false)

  // Detect PWA standalone mode so we can nudge users away from guest when they
  // installed the app — closing a PWA window wipes sessionStorage same as a tab.
  // Lazy init reads the match synchronously; the listener handles orientation /
  // display-mode changes that happen while the page is open.
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(display-mode: standalone)')
    const handler = (e: MediaQueryListEvent) => setIsStandalone(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const handleGuest = async () => {
    if (guestPending) return
    setGuestPending(true)
    try {
      await startGuest()
    } finally {
      setGuestPending(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-brand-bg)]">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        {/* Big logo + tagline block. Sized generously on mobile (5xl) and even
            bigger on desktop so it owns the page. Mirrors the in-app wordmark. */}
        <div className="text-center mb-8 sm:mb-10">
          <h1
            className="text-5xl sm:text-6xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-heading), var(--font-sans)' }}
          >
            <span className="text-[var(--color-brand-text-primary)]">Bud</span>
            <span className="text-[var(--color-brand-red)]">d</span>
            <span className="text-[var(--color-brand-text-primary)]">get</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[var(--color-brand-text-muted)]">
            {t.brand.tagline}
          </p>
        </div>

        {/* Sign-in / sign-up card — same body the overlay modal uses. */}
        <div
          className="w-full max-w-md border rounded-2xl p-6 sm:p-8 shadow-xl"
          style={{
            background: 'var(--color-brand-card)',
            borderColor: 'var(--color-brand-border)',
          }}
        >
          <AuthModalBody showBranding={false} />
        </div>

        {/* Guest CTA below the card. Divider + short helper text + button. */}
        <div className="w-full max-w-md mt-6 space-y-2">
          <div className="relative flex items-center gap-3">
            <span className="flex-1 h-px bg-[var(--color-brand-border)]" />
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-brand-text-muted)]">
              {t.landing.or}
            </span>
            <span className="flex-1 h-px bg-[var(--color-brand-border)]" />
          </div>
          <button
            type="button"
            onClick={() => void handleGuest()}
            disabled={guestPending}
            className="w-full h-11 rounded-xl font-medium text-sm transition-colors text-[var(--color-brand-text-primary)] bg-[var(--color-brand-elevated)] hover:bg-[var(--color-brand-border)] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {guestPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
            {t.landing.ctaGuest}
          </button>
          <p className="text-[11px] text-[var(--color-brand-text-muted)] leading-relaxed text-center">
            {isStandalone ? t.landing.guestHelpStandalone : t.landing.guestHelp}
          </p>
        </div>
      </main>
    </div>
  )
}
