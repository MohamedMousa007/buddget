'use client'

import { AuthModalBody } from '@/components/features/auth-modal/AuthModalBody'
import { useT } from '@/lib/i18n'

/**
 * Pre-auth landing screen. Email-first morph form centred vertically on the
 * viewport with a large "Buddget" wordmark sitting above it. The former
 * "continue as guest" CTA has been retired — sign-in / sign-up is the only
 * path into the app.
 */
export function LandingGate() {
  const t = useT()

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] flex items-center justify-center">
      <main className="mx-auto w-full max-w-md px-4 py-8">
        {/* Large centred wordmark. */}
        <div className="text-center mb-6 sm:mb-8">
          <h1
            className="text-5xl sm:text-6xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-heading), var(--font-sans)' }}
          >
            <span className="text-[var(--color-brand-text-primary)]">Bud</span>
            <span className="text-[var(--color-brand-red)]">d</span>
            <span className="text-[var(--color-brand-text-primary)]">get</span>
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[var(--color-brand-text-muted)]">
            {t.brand.tagline}
          </p>
        </div>

        {/* Auth card — same body the global modal uses. */}
        <div
          className="w-full border rounded-2xl p-5 sm:p-6 shadow-xl"
          style={{
            background: 'var(--color-brand-card)',
            borderColor: 'var(--color-brand-border)',
          }}
        >
          <AuthModalBody showBranding={false} />
        </div>
      </main>
    </div>
  )
}
