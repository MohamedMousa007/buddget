'use client'

import type { CSSProperties } from 'react'
import { AuthModalBody } from '@/components/features/auth-modal/AuthModalBody'
import { useT } from '@/lib/i18n'

function tickerItemStyle(delaySeconds: number): CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    fontSize: '16px',
    fontWeight: 400,
    letterSpacing: '-0.2px',
    lineHeight: 1.35,
    color: 'rgba(255,255,255,.75)',
    animation: 'lgRotHead3 13.5s ease-in-out infinite',
    animationFillMode: 'backwards',
    animationDelay: `${delaySeconds}s`,
  }
}

const ACCENT: CSSProperties = { fontWeight: 700, color: '#E50914' }

/**
 * Pre-auth landing screen. Email-first morph form centred vertically on the
 * viewport with a large "Buddget" wordmark sitting above it.
 *
 * In dark mode the background matches the WelcomeScreen gradient with an
 * ambient red glow and a cycling marketing ticker at the bottom.
 */
export function LandingGate() {
  const t = useT()

  return (
    <>
      <style>{`
        @keyframes lgBreathe {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: .6; }
          50% { transform: translateX(-50%) scale(1.12); opacity: .9; }
        }
        @keyframes lgRotHead3 {
          0%   { opacity: 0; transform: translateY(12px); }
          4%   { opacity: 1; transform: translateY(0); }
          29%  { opacity: 1; transform: translateY(0); }
          33%  { opacity: 0; transform: translateY(-12px); }
          100% { opacity: 0; }
        }
        @media (prefers-color-scheme: dark) {
          .lg-bg { background: linear-gradient(180deg, #2C2C35, #222229) !important; }
          .lg-glow, .lg-ticker { display: block !important; }
        }
        .dark .lg-bg { background: linear-gradient(180deg, #2C2C35, #222229) !important; }
        .dark .lg-glow, .dark .lg-ticker { display: block !important; }
        @media (prefers-reduced-motion: reduce) {
          .lg-glow { animation: none !important; opacity: .6; }
          .lg-ticker p { animation: none !important; opacity: 0; }
          .lg-ticker p:first-child { opacity: 1 !important; }
        }
      `}</style>

      {/* Layout note: top-aligned on phones so the soft keyboard doesn't push the
          wordmark off-screen when an input is focused. sm:items-center restores
          the centred look on tablets/desktop. */}
      <div className="lg-bg min-h-[100svh] bg-[var(--color-brand-bg)] relative overflow-hidden flex items-start justify-center pt-[max(env(safe-area-inset-top),2rem)] pb-8 sm:items-center sm:pt-0 sm:pb-0">

        {/* Ambient glow — dark mode only */}
        <div
          className="lg-glow"
          style={{
            display: 'none',
            position: 'absolute',
            top: '-110px',
            left: '50%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(229,9,20,.28), transparent 68%)',
            filter: 'blur(8px)',
            animation: 'lgBreathe 8s ease-in-out infinite',
            zIndex: 0,
          }}
        />

        <main className="mx-auto w-full max-w-md px-4 py-4 sm:py-8 relative z-10">
          {/* Large centred wordmark */}
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

          {/* Auth card — same body the global modal uses */}
          <div
            className="w-full border rounded-2xl p-5 sm:p-6 shadow-xl"
            style={{
              background: 'var(--color-brand-card)',
              borderColor: 'var(--color-brand-border)',
            }}
          >
            <AuthModalBody showBranding={false} />
          </div>

          {/* Legal footer */}
          <p className="mt-6 text-center text-[11px] text-[var(--color-brand-text-muted)]">
            <a href="/legal/privacy" className="hover:text-[var(--color-brand-text-secondary)] transition-colors">
              Privacy Policy
            </a>
            <span className="mx-2" aria-hidden>·</span>
            <a href="/legal/terms" className="hover:text-[var(--color-brand-text-secondary)] transition-colors">
              Terms of Service
            </a>
          </p>
        </main>

        {/* Marketing ticker — dark mode only, fixed to viewport bottom */}
        <div
          className="lg-ticker"
          style={{
            display: 'none',
            position: 'fixed',
            left: '36px',
            right: '36px',
            bottom: 'max(env(safe-area-inset-bottom, 0px), 24px)',
            height: '48px',
            textAlign: 'center',
            zIndex: 20,
          }}
        >
          <p style={tickerItemStyle(0)}>
            Track your money <span style={ACCENT}>without trying.</span>
          </p>
          <p style={tickerItemStyle(4.5)}>
            Every expense, <span style={ACCENT}>caught</span> on its way.
          </p>
          <p style={tickerItemStyle(9)}>
            <span style={ACCENT}>Private</span> by design, always.
          </p>
        </div>
      </div>
    </>
  )
}
