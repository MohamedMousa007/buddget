'use client'

/**
 * NumberPad — glass ("glass-bare") variant.
 *
 * A custom bottom-sheet numeric keypad that replaces the OS keyboard for money
 * entry (expense/income amounts, debt/loan amounts, savings targets, budget
 * limits) and for card last-4 / PIN entry. Its surface reuses the sign-in /
 * loading gradient + glow so it reads as part of the same visual family; keys
 * are borderless glyphs floating on the glass.
 *
 * This file is a faithful, no-deviation port of the HTML prototype
 * (prototypes/Numpad.dc.html, variant = "glassBare"). Every hex / rgba / px
 * value below is exact. Adjust ONLY to match project conventions (e.g. moving
 * the @keyframes into globals.css, or swapping the inline styles for Tailwind
 * arbitrary values) — do not change the numbers.
 *
 * Icons: lucide-react `Delete` (the backspace/erase-left glyph) — matches the
 * app's existing icon system. Fonts come from the app's CSS variables
 * (--font-mono = JetBrains Mono for figures, --font-sans = DM Sans for UI).
 *
 * Mount in a portal to document.body (or the global modal root) so the
 * position:fixed sheet is not clipped by any transformed ancestor.
 */

import { Delete } from 'lucide-react'
import type { CSSProperties } from 'react'

export type NumberPadMode = 'decimal' | 'pin'

export interface NumberPadProps {
  /** Current string value, owned by the parent (controlled). */
  value: string
  /** Called on every key press with the full next string. */
  onChange: (next: string) => void
  /** Primary "Done" action — dismiss the pad. */
  onDone: () => void
  /** Scrim tap / close. Falls back to onDone if omitted. */
  onClose?: () => void
  /** 'decimal' for money, 'pin' for card last-4 (max 4, no decimal key, dot readout). */
  mode?: NumberPadMode
  /** ISO code / symbol shown in the built-in display header (decimal mode). */
  currency?: string
  /** Header caption. Defaults per mode. */
  label?: string
  /** Show the built-in amount/dots header. Keep FALSE when a field above the
   *  pad already shows the number (the expense-form case); TRUE for a
   *  standalone pad (e.g. a PIN screen). */
  showDisplay?: boolean
  dir?: 'ltr' | 'rtl'
}

const RED = '#E50914'

/* ────────────────────────────────────────────────────────────────────────
   Pure input reducer — the single source of truth for typing behaviour.
   Ported verbatim from the prototype's press() method. Unit-test this.
   ──────────────────────────────────────────────────────────────────────── */
export function nextValue(value: string, key: string, mode: NumberPadMode): string {
  let v = value || ''
  if (key === 'back') return v.slice(0, -1)
  if (key === '.') {
    if (mode !== 'pin' && !v.includes('.')) return v === '' ? '0.' : v + '.'
    return v
  }
  // digit
  if (mode === 'pin') {
    if (v.length >= 4) return v            // cap PIN / last-4 at 4 chars
    return v + key
  }
  if (v.includes('.')) {
    const dec = v.split('.')[1]
    if (dec.length >= 2) return v          // max 2 decimal places
  }
  if (v === '0') return key === '0' ? '0' : key   // no leading-zero runs
  return v + key
}

/** Group the integer part with thousands separators; keep decimals as typed. */
export function formatAmount(v: string): string {
  if (!v) return '0'
  const [int, dec] = v.split('.')
  const grouped = Number(int || '0').toLocaleString('en-US')
  return dec !== undefined ? `${grouped}.${dec}` : grouped
}

const KEYS_DECIMAL = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back']
const KEYS_PIN = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'blank', '0', 'back']

export function NumberPad({
  value,
  onChange,
  onDone,
  onClose,
  mode = 'decimal',
  currency = 'EGP',
  label,
  showDisplay = false,
  dir = 'ltr',
}: NumberPadProps) {
  const isPin = mode === 'pin'
  const keys = isPin ? KEYS_PIN : KEYS_DECIMAL
  const caption = label ?? (isPin ? 'Card last 4 digits' : 'Amount')

  // Borderless key — the "glass-bare" signature. Backspace only differs in colour.
  const digitStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    border: 'none',
    borderRadius: 16,
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    background: 'transparent',
    color: '#FFFFFF',
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
    fontSize: 28,
    transition: 'background .12s',
  }
  const backStyle: CSSProperties = { ...digitStyle, color: '#C9C9D6' }

  return (
    <div dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 120, fontFamily: 'var(--font-sans)' }}>
      {/* Keyframes + the :active press highlight (inline styles can't express :active).
          Move these into globals.css if you prefer — values must stay identical. */}
      <style>{`
        @keyframes npUp   { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes npFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes npGlow { 0%,100% { transform: translate(-50%,0) scale(1); opacity:.7 } 50% { transform: translate(-50%,0) scale(1.16); opacity:1 } }
        .np-key:active { background: rgba(255,255,255,.12) !important; }
        @media (prefers-reduced-motion: reduce) {
          .np-glow { animation: none !important; opacity: .7 !important; }
        }
      `}</style>

      {/* Scrim — identical to the sign-in modal: bg-black/25 + backdrop-blur-md.
          Keeps the form visible above the pad. */}
      <button
        type="button"
        aria-label="Close number pad"
        onClick={() => (onClose ?? onDone)()}
        style={{
          position: 'absolute',
          inset: 0,
          border: 'none',
          cursor: 'default',
          background: 'rgba(0,0,0,.25)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          animation: 'npFade .2s ease',
        }}
      />

      {/* Glass sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={caption}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          background:
            'radial-gradient(120% 82% at 50% -12%, rgba(229,9,20,.20) 0%, rgba(229,9,20,.05) 40%, rgba(20,18,26,0) 66%), ' +
            'linear-gradient(180deg, rgba(30,25,34,.80) 0%, rgba(18,16,22,.86) 58%, rgba(12,10,16,.90) 100%)',
          backdropFilter: 'blur(26px)',
          WebkitBackdropFilter: 'blur(26px)',
          borderTop: '1px solid rgba(255,255,255,.12)',
          boxShadow: '0 -20px 50px -20px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06)',
          borderRadius: '28px 28px 0 0',
          padding: '8px 16px 20px',
          // respect the iOS home-indicator inset in the native shell
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          animation: 'npUp .32s cubic-bezier(.22,1,.36,1)',
        }}
      >
        {/* Breathing red glow blob */}
        <div
          aria-hidden
          className="np-glow"
          style={{
            position: 'absolute',
            top: '8%',
            left: '50%',
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(229,9,20,.30), transparent 68%)',
            filter: 'blur(10px)',
            animation: 'npGlow 8s ease-in-out infinite',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />

        {/* Content sits above the glow */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Grab handle */}
          <div style={{ width: 40, height: 4, borderRadius: 999, background: 'rgba(255,255,255,.22)', margin: '2px auto 8px' }} />

          {showDisplay && (
            <div style={{ padding: '6px 6px 14px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  fontSize: 10,
                  letterSpacing: '.09em',
                  textTransform: 'uppercase',
                  color: '#8E8EA6',
                  textAlign: 'center',
                  marginBottom: 9,
                }}
              >
                {caption}
              </div>

              {isPin ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        transition: 'all .15s',
                        ...(i < value.length
                          ? { background: RED, transform: 'scale(1)', boxShadow: '0 0 12px rgba(229,9,20,.5)' }
                          : { background: 'rgba(255,255,255,.16)', transform: 'scale(.82)' }),
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 9 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 17, color: '#8A8AA0' }}>{currency}</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: 42,
                      letterSpacing: '-0.02em',
                      lineHeight: 1,
                      color: value ? '#FFFFFF' : 'rgba(255,255,255,.32)',
                    }}
                  >
                    {formatAmount(value)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Key grid — 3 columns, 4px gap */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginTop: 2 }}>
            {keys.map((k, i) => {
              if (k === 'blank') return <span key={i} aria-hidden />
              const isBack = k === 'back'
              return (
                <button
                  key={i}
                  type="button"
                  className="np-key"
                  onClick={() => onChange(nextValue(value, k, mode))}
                  style={isBack ? backStyle : digitStyle}
                  aria-label={isBack ? 'Delete' : k}
                >
                  {isBack ? <Delete size={26} strokeWidth={2} /> : k}
                </button>
              )
            })}
          </div>

          {/* Done — red-gradient CTA with red glow */}
          <button
            type="button"
            onClick={onDone}
            onMouseDown={(e) => e.preventDefault()}
            style={{
              width: '100%',
              height: 54,
              marginTop: 10,
              border: 'none',
              borderRadius: 16,
              background: 'linear-gradient(160deg,#F40612,#C5070F)',
              color: '#fff',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: '0 10px 26px -10px rgba(229,9,20,.7)',
              transition: 'filter .15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
          >
            {dir === 'rtl' ? 'تم' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}
