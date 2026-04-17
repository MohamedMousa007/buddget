'use client'

import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-context'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { useT } from '@/lib/i18n'

/**
 * Pre-auth landing screen. Replaces the dashboard for unauthenticated users
 * who haven't started a guest session. Three choices: sign in, sign up, or
 * continue as a guest (tab-scoped, no account).
 *
 * Deep links are preserved via the current pathname → `next` param for
 * sign-in / sign-up flows. Guest choice always routes to
 * /guest-onboarding → / (by design — guests forfeit the bookmarked target).
 */
export function LandingGate() {
  const t = useT()
  const pathname = usePathname()
  const { openAuthModal, startGuest } = useAuth()

  const nextPath = pathname && pathname !== '/' ? pathname : '/'

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-brand-bg)]">
      <header className="flex items-center justify-between px-4 py-3">
        <h1
          className="text-xl font-extrabold tracking-tight"
          style={{ fontFamily: 'var(--font-heading), var(--font-sans)' }}
        >
          <span className="text-[var(--color-brand-text-primary)]">Bud</span>
          <span className="text-[var(--color-brand-red)]">d</span>
          <span className="text-[var(--color-brand-text-primary)]">get</span>
        </h1>
        <LanguageToggle size="sm" />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-10">
        <div
          className="w-full max-w-md border rounded-2xl p-8 space-y-6 shadow-xl"
          style={{
            background: 'var(--color-brand-card)',
            borderColor: 'var(--color-brand-border)',
          }}
        >
          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--color-brand-red)]" />
              <h2 className="text-2xl font-bold text-[var(--color-brand-text-primary)]">
                {t.landing.heroTitle}
              </h2>
            </div>
            <p className="text-sm text-[var(--color-brand-text-muted)] leading-relaxed">
              {t.landing.heroSubtitle}
            </p>
          </div>

          <ul className="space-y-2 text-sm text-[var(--color-brand-text-secondary)]">
            <li className="flex items-start gap-2">
              <span className="text-[var(--color-brand-green)] mt-0.5">✓</span>
              <span>{t.landing.feature1}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--color-brand-green)] mt-0.5">✓</span>
              <span>{t.landing.feature2}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--color-brand-green)] mt-0.5">✓</span>
              <span>{t.landing.feature3}</span>
            </li>
          </ul>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => openAuthModal(nextPath, null, 'signup')}
              className="w-full h-12 rounded-xl font-semibold text-white transition-colors bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)]"
            >
              {t.landing.ctaSignUp}
            </button>
            <button
              type="button"
              onClick={() => openAuthModal(nextPath, null, 'signin')}
              className="w-full h-12 rounded-xl font-semibold border transition-colors text-[var(--color-brand-text-primary)] border-[var(--color-brand-border)] hover:bg-[var(--color-brand-elevated)]"
            >
              {t.landing.ctaSignIn}
            </button>
          </div>

          <div className="relative flex items-center gap-3">
            <span className="flex-1 h-px bg-[var(--color-brand-border)]" />
            <span className="text-[11px] uppercase tracking-wider text-[var(--color-brand-text-muted)]">
              {t.landing.or}
            </span>
            <span className="flex-1 h-px bg-[var(--color-brand-border)]" />
          </div>

          <div className="space-y-1.5 text-center">
            <button
              type="button"
              onClick={() => startGuest()}
              className="w-full h-11 rounded-xl font-medium text-sm transition-colors text-[var(--color-brand-text-primary)] bg-[var(--color-brand-elevated)] hover:bg-[var(--color-brand-border)]"
            >
              {t.landing.ctaGuest}
            </button>
            <p className="text-[11px] text-[var(--color-brand-text-muted)] leading-relaxed">
              {t.landing.guestHelp}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
