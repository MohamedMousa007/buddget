'use client'

/**
 * NumberPad — glass ("glass-bare") bottom-sheet numeric keypad that replaces the
 * OS keyboard for money entry and card last-4 / PIN entry. Samsung/OEM keyboards
 * ignore inputMode and force QWERTY, so amount fields drive this pad instead.
 *
 * Faithful port of design/design_handoff_glass_numpad. Keyframes + the :active
 * press highlight live in globals.css (npUp/npFade/npGlow, .np-key). Controlled:
 * each key press computes the full next string via nextValue() and calls onChange.
 */

import { useEffect } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { Delete } from 'lucide-react'
import type { CSSProperties } from 'react'
import { registerBackGuard } from '@/lib/navigation/backGuard'

export type NumberPadMode = 'decimal' | 'integer' | 'pin'

export interface NumberPadProps {
  value: string
  onChange: (next: string) => void
  onDone: () => void
  onClose?: () => void
  mode?: NumberPadMode
  currency?: string
  label?: string
  /** Show the built-in amount/dots header. FALSE when a field above already
   *  shows the number (the expense-form case); TRUE for a standalone pad. */
  showDisplay?: boolean
  dir?: 'ltr' | 'rtl'
}

const RED = 'var(--color-brand-red)'

/** Pure input reducer — the single source of truth for typing behaviour. */
export function nextValue(value: string, key: string, mode: NumberPadMode): string {
  const v = value || ''
  if (key === 'back') return v.slice(0, -1)
  if (key === '.') {
    if (mode === 'decimal' && !v.includes('.')) return v === '' ? '0.' : v + '.'
    return v // integer / pin have no decimal key
  }
  if (mode === 'pin') {
    if (v.length >= 4) return v
    return v + key
  }
  if (v.includes('.')) {
    const dec = v.split('.')[1]
    if (dec.length >= 2) return v
  }
  if (v === '0') return key === '0' ? '0' : key
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
const KEYS_NODOT = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'blank', '0', 'back']

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
  const keys = mode === 'decimal' ? KEYS_DECIMAL : KEYS_NODOT
  const caption = label ?? (isPin ? 'Card last 4 digits' : 'Amount')

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

  const close = () => (onClose ?? onDone)()
  const dragControls = useDragControls()

  // Hardware back / edge-swipe closes the pad first (returns true = handled),
  // so the modal behind it survives the first press — like a system keyboard.
  useEffect(() => registerBackGuard(() => { close(); return true }))

  return (
    <div dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 120, fontFamily: 'var(--font-sans)' }}>
      {/* Scrim — transparent (no blur/dim) so the form and its live value stay
          fully visible above the pad, exactly like the OS keyboard. Tap closes. */}
      <button
        type="button"
        aria-label="Close number pad"
        onClick={close}
        style={{ position: 'absolute', inset: 0, border: 'none', cursor: 'default', background: 'transparent' }}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={caption}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.35 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 90 || info.velocity.y > 450) close()
        }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          background:
            'radial-gradient(120% 82% at 50% -12%, rgba(229,9,20,.20) 0%, rgba(229,9,20,.05) 40%, rgba(20,18,26,0) 66%), ' +
            'linear-gradient(180deg, rgba(30,25,34,.56) 0%, rgba(18,16,22,.62) 58%, rgba(12,10,16,.66) 100%)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderTop: '1px solid rgba(255,255,255,.12)',
          boxShadow: '0 -20px 50px -20px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06)',
          borderRadius: '28px 28px 0 0',
          padding: '8px 16px 20px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        }}
      >
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

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Grab handle — the swipe-down-to-dismiss affordance. Enlarged hit area. */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            style={{ display: 'flex', justifyContent: 'center', padding: '2px 0 6px', cursor: 'grab', touchAction: 'none' }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 999, background: 'rgba(255,255,255,.22)' }} />
          </div>

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
      </motion.div>
    </div>
  )
}
