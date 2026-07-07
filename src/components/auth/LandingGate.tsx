'use client'

import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { AuthModalBody } from '@/components/features/auth-modal/AuthModalBody'
import { useT } from '@/lib/i18n'

function blurActive() {
  ;(document.activeElement as HTMLElement | null)?.blur?.()
}

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
    // Colour lives in CSS (`.lg-ticker p`) so it can be theme-aware.
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
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  // Hide the bottom ticker while the keyboard is up. Primary signal is the
  // visualViewport shrinking (reliable when the WebView resizes for the
  // keyboard); focus events are a secondary trigger for cases where the viewport
  // doesn't shrink. keyboardOpen = either fired. Touch devices only.
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) return
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)

    const vv = window.visualViewport
    let viewportHidden = false
    let focusHidden = false
    const apply = () => setKeyboardOpen(viewportHidden || focusHidden)

    const onViewport = () => {
      viewportHidden = vv ? window.innerHeight - vv.height > 120 : false
      apply()
    }
    const onFocusIn = (e: FocusEvent) => {
      if (isField(e.target)) { focusHidden = true; apply() }
    }
    const onFocusOut = () => {
      queueMicrotask(() => { focusHidden = isField(document.activeElement); apply() })
    }

    vv?.addEventListener('resize', onViewport)
    vv?.addEventListener('scroll', onViewport)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    onViewport()
    return () => {
      vv?.removeEventListener('resize', onViewport)
      vv?.removeEventListener('scroll', onViewport)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  return (
    <>
      <style>{`
        @keyframes lgBreathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: .6; }
          50% { transform: translate(-50%, -50%) scale(1.12); opacity: .9; }
        }
        @keyframes lgRotHead3 {
          0%   { opacity: 0; transform: translateY(12px); }
          4%   { opacity: 1; transform: translateY(0); }
          29%  { opacity: 1; transform: translateY(0); }
          33%  { opacity: 0; transform: translateY(-12px); }
          100% { opacity: 0; }
        }
        /* Fixed neutral brand canvas — identical in light and dark OS/app theme.
           The whole gate is wrapped in .dark (below) so every brand token resolves
           to its dark value; there is no light variant of the auth screen. */
        .lg-bg {
          background:
            radial-gradient(120% 60% at 50% -6%, rgba(229,9,20,.26) 0%, rgba(229,9,20,.06) 38%, rgba(20,18,26,0) 62%),
            linear-gradient(180deg, #1A1720 0%, #121016 55%, #0E0C12 100%) !important;
        }
        .lg-ticker p { color: rgba(255,255,255,.75); }
        @media (prefers-reduced-motion: reduce) {
          .lg-glow { animation: none !important; opacity: .6; }
          .lg-ticker p { animation: none !important; opacity: 0; }
          .lg-ticker p:first-child { opacity: 1 !important; }
        }
        .lg-ticker-hide { display: none !important; }
      `}</style>

      {/* Layout note: top-aligned on phones so the soft keyboard doesn't push the
          wordmark off-screen when an input is focused. sm:items-center restores
          the centred look on tablets/desktop. */}
      <div className="dark lg-bg min-h-[100svh] relative overflow-hidden flex items-start justify-center pt-[max(env(safe-area-inset-top),2rem)] pb-8 sm:items-center sm:pt-0 sm:pb-0">

        {/* Ambient glow — bloom behind the wordmark, fixed so keyboard opening doesn't shift it */}
        <div
          className="lg-glow"
          style={{
            position: 'fixed',
            top: '16%',
            left: '50%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(229,9,20,.28), transparent 68%)',
            filter: 'blur(8px)',
            animation: 'lgBreathe 8s ease-in-out infinite',
            zIndex: 0,
            pointerEvents: 'none',
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
              background: 'rgba(255,255,255,0.045)',
              borderColor: 'rgba(255,255,255,0.09)',
            }}
          >
            <AuthModalBody showBranding={false} />
          </div>

          {/* Legal footer */}
          <p className="mt-6 text-center text-xs text-[var(--color-brand-text-muted)]">
            <Link href="/legal/privacy" onClick={blurActive} className="hover:text-[var(--color-brand-text-secondary)] transition-colors">
              Privacy Policy
            </Link>
            <span className="mx-2" aria-hidden>·</span>
            <Link href="/legal/terms" onClick={blurActive} className="hover:text-[var(--color-brand-text-secondary)] transition-colors">
              Terms of Service
            </Link>
          </p>
        </main>

        {/* Marketing ticker — both themes, fixed to viewport bottom; hidden while typing */}
        <div
          className={`lg-ticker${keyboardOpen ? ' lg-ticker-hide' : ''}`}
          style={{
            position: 'fixed',
            left: '36px',
            right: '36px',
            bottom: 'max(env(safe-area-inset-bottom, 0px), 24px)',
            height: '48px',
            textAlign: 'center',
            zIndex: 20,
            pointerEvents: 'none',
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
