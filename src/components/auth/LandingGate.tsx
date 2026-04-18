'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-context'
import { AuthModalBody } from '@/components/features/auth-modal/AuthModalBody'
import { useT } from '@/lib/i18n'

/**
 * Pre-auth landing screen. Mobile-first and, critically, scroll-safe:
 * whichever form the user is on (sign-in is short, sign-up is taller with the
 * strength meter + confirm field), the layout flows top-down so everything is
 * reachable — we do NOT vertical-center and silently clip overflow.
 *
 * Shared auth body (`AuthModalBody`) covers OAuth + credential form + forgot +
 * verify steps. The guest CTA lives below the card as a secondary path.
 */
export function LandingGate() {
  const t = useT()
  const { startGuest } = useAuth()
  const [guestPending, setGuestPending] = useState(false)

  // Detect PWA standalone mode so we can nudge users away from guest when they
  // installed the app — closing a PWA window wipes sessionStorage same as a tab.
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
    // Top-down flow, not justify-center. If content is shorter than the
    // viewport it sits near the top with breathing room; if it's taller (e.g.
    // sign-up + strength meter), the page scrolls and everything stays
    // reachable. Outer min-h-screen lets the body paint the bg colour past
    // the fold too.
    <div className="min-h-screen bg-[var(--color-brand-bg)]">
      <main className="mx-auto w-full max-w-md flex flex-col items-stretch px-4 pt-4 pb-6 sm:pt-6 sm:pb-8">
        {/* Compact logo row — visible but doesn't consume vertical budget. */}
        <div className="text-center mb-3 sm:mb-4">
          <h1
            className="text-2xl sm:text-3xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-heading), var(--font-sans)' }}
          >
            <span className="text-[var(--color-brand-text-primary)]">Bud</span>
            <span className="text-[var(--color-brand-red)]">d</span>
            <span className="text-[var(--color-brand-text-primary)]">get</span>
          </h1>
          <p className="mt-1 text-[11px] sm:text-xs text-[var(--color-brand-text-muted)]">
            {t.brand.tagline}
          </p>
        </div>

        {/* Sign-in / sign-up card — same body the overlay modal uses. */}
        <div
          className="w-full border rounded-2xl p-4 sm:p-5 shadow-xl"
          style={{
            background: 'var(--color-brand-card)',
            borderColor: 'var(--color-brand-border)',
          }}
        >
          <AuthModalBody showBranding={false} />
        </div>

        {/* Guest CTA below the card. Divider + short helper text + button.
            Bordered so it contrasts against both the page bg AND the card. */}
        <div className="w-full mt-3 space-y-1.5">
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
            className="w-full h-10 sm:h-11 rounded-xl font-medium text-sm transition-colors text-[var(--color-brand-text-primary)] bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] hover:border-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)] disabled:opacity-60 flex items-center justify-center gap-2"
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
