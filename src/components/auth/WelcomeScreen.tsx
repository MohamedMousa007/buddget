'use client'

import type { CSSProperties } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/auth-context'
import { emailLocalPart } from '@/lib/auth/emailLocalPart'

function getGreeting(hour: number, isArabic: boolean): string {
  if (isArabic) return hour < 12 ? 'صباح الخير' : 'مساء الخير'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function tickerItemStyle(delaySeconds: number): CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    fontSize: '19px',
    fontWeight: 400,
    letterSpacing: '-0.3px',
    lineHeight: 1.25,
    color: 'rgba(255,255,255,.78)',
    animation: 'wmRotHead3 13.5s ease-in-out infinite',
    animationFillMode: 'backwards',
    animationDelay: `${delaySeconds}s`,
  }
}

const ACCENT: CSSProperties = { fontWeight: 700, color: '#E50914' }

export function WelcomeScreen() {
  const { user } = useAuth()
  const profileName = useFinanceStore((s) => s.profile.name)
  const language = useFinanceStore((s) => s.settings.language)
  const isArabic = language === 'ar'

  // Personal greeting from the first frame: the real name once the profile has
  // loaded, otherwise the signed-in user's own email local-part (their own
  // address — no privacy concern). Never blank on first sign-in.
  const name = profileName?.trim() || emailLocalPart(user?.email ?? '')

  const hour = new Date().getHours()
  const greeting = getGreeting(hour, isArabic)

  const bodyFont = isArabic
    ? 'var(--font-sans-ar), var(--font-sans), sans-serif'
    : 'var(--font-sans), sans-serif'

  return (
    <>
      <style>{`
        @keyframes wmBreathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: .7; }
          50% { transform: translate(-50%, -50%) scale(1.14); opacity: 1; }
        }
        @keyframes wmRotHead3 {
          0%   { opacity: 0; transform: translateY(14px); }
          4%   { opacity: 1; transform: translateY(0); }
          29%  { opacity: 1; transform: translateY(0); }
          33%  { opacity: 0; transform: translateY(-14px); }
          100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wm-glow { animation: none !important; opacity: .7; }
          .wm-ticker p { animation: none !important; opacity: 0; }
          .wm-ticker p:first-child { opacity: 1; }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'linear-gradient(180deg, #2C2C35, #222229)',
          overflow: 'hidden',
          color: '#fff',
          fontFamily: bodyFont,
          direction: isArabic ? 'rtl' : 'ltr',
          zIndex: 9999,
        }}
      >
        {/* Ambient glow — centred on screen, not behind the wordmark */}
        <div
          className="wm-glow"
          style={{
            position: 'absolute',
            top: '35%',
            left: '50%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(229,9,20,.28), transparent 68%)',
            filter: 'blur(8px)',
            animation: 'wmBreathe 8s ease-in-out infinite',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Hero — vertically + horizontally centred */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 36px',
            textAlign: 'center',
          }}
        >
          {/* Wordmark — always Latin / LTR */}
          <div
            style={{
              fontFamily: 'var(--font-heading), var(--font-sans), sans-serif',
              fontSize: '60px',
              fontWeight: 800,
              letterSpacing: '-2px',
              lineHeight: 1,
              direction: 'ltr',
            }}
          >
            Bud<span style={{ color: '#E50914' }}>d</span>get
          </div>

          {/* Greeting */}
          <p
            style={{
              marginTop: '22px',
              fontSize: '18px',
              fontWeight: 400,
              color: 'rgba(255,255,255,.60)',
            }}
          >
            {greeting}
            {name ? (
              <>
                {isArabic ? ' ' : ', '}
                <strong style={{ color: '#fff', fontWeight: 600 }}>{name}</strong>
              </>
            ) : null}
          </p>
        </div>

        {/* Statement ticker */}
        <div
          className="wm-ticker"
          style={{
            position: 'absolute',
            left: '36px',
            right: '36px',
            bottom: '70px',
            height: isArabic ? '60px' : '54px',
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          {isArabic ? (
            <>
              <p style={tickerItemStyle(0)}>
                تتبَّع أموالك <span style={ACCENT}>دون عناء.</span>
              </p>
              <p style={tickerItemStyle(4.5)}>
                كل عملية شراء <span style={ACCENT}>تُرصَد</span> لحظة حدوثها.
              </p>
              <p style={tickerItemStyle(9)}>
                <span style={ACCENT}>خصوصيتك</span> مصونة بالتصميم، دائمًا.
              </p>
            </>
          ) : (
            <>
              <p style={tickerItemStyle(0)}>
                Track your money <span style={ACCENT}>without trying.</span>
              </p>
              <p style={tickerItemStyle(4.5)}>
                Every expense, <span style={ACCENT}>caught</span> on its way.
              </p>
              <p style={tickerItemStyle(9)}>
                <span style={ACCENT}>Private</span> by design, always.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}
