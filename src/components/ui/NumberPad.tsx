'use client'

/**
 * NumberPad — the in-app numeric keypad that replaces the OS keyboard for money entry and card
 * last-4 / PIN entry (Samsung/OEM keyboards ignore inputMode and force QWERTY).
 *
 * Laid out like the phone's own numpad: three columns, 54px keys, 8px gaps, a flat surface
 * (no blur or glow, so it paints fast). Keys act on pointer-down and read the freshest value
 * from a ref, so rapid taps never lose a digit. Key look lives in globals.css (.np-key).
 * Controlled: each press computes the next string via nextValue() and calls onChange.
 */

import { useEffect, useRef } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { Delete } from 'lucide-react'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { setNumpadInset } from '@/lib/ui/numpadInset'
import { useScrollLock } from '@/lib/ui/scrollLock'

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

  const close = () => (onClose ?? onDone)()

  // Hardware back / edge-swipe closes the pad first (returns true = handled),
  // so the modal behind it survives the first press — like a system keyboard.
  useEffect(() => registerBackGuard(() => { close(); return true }))

  // Escape closes only the pad — capture + stopPropagation keeps the modal behind it open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  // Lock background scroll while the pad is open; ref-counted so it composes with the ModalShell behind it.
  useScrollLock(true)

  // Drag only from the top handle (below) — never from the keys.
  const dragControls = useDragControls()

  // Publish the pad's height so an open ModalShell lifts its content above it,
  // reusing the keyboard-avoidance path (see numpadInset / ModalShell).
  const sheetRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    const measure = () => setNumpadInset(el.getBoundingClientRect().height)
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      setNumpadInset(0)
    }
  }, [])

  // The freshest value, updated synchronously on every press so two taps inside one frame both land.
  const latest = useRef(value)
  useEffect(() => { latest.current = value }, [value])
  const press = (key: string) => {
    const next = nextValue(latest.current, key, mode)
    if (next === latest.current) return
    latest.current = next
    onChange(next)
  }

  // Press-and-hold backspace: deletes faster the longer it is held, like a keyboard.
  const holdTimer = useRef<number | undefined>(undefined)
  const stopHold = () => {
    if (holdTimer.current !== undefined) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = undefined
    }
  }
  useEffect(() => stopHold, [])
  const startBackspace = () => {
    stopHold()
    press('back')
    let delay = 320
    const tick = () => {
      if (!latest.current) return stopHold()
      press('back')
      delay = Math.max(45, delay * 0.78)
      holdTimer.current = window.setTimeout(tick, delay)
    }
    holdTimer.current = window.setTimeout(tick, 380)
  }

  return (
    <div dir={dir} className="fixed inset-0 z-[var(--z-sheet-nested)] font-sans [overscroll-behavior:contain] [touch-action:none]">
      {/* Transparent scrim: the form and its live value stay visible above the pad, like the OS keyboard. Tap closes. */}
      <button
        type="button"
        aria-label="Close number pad"
        onClick={close}
        onTouchMove={(e) => e.preventDefault()}
        className="absolute inset-0 cursor-default border-0 bg-transparent [touch-action:none]"
      />

      <motion.div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={caption}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.y > 70 || info.velocity.y > 380) close()
        }}
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[480px] rounded-t-3xl border-t border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 shadow-[var(--shadow-lg)]"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        {/* Grab handle — the sole drag initiator, so keys never move the pad. */}
        <div
          onPointerDown={(e) => dragControls.start(e)}
          role="presentation"
          aria-hidden
          className="flex min-h-9 cursor-grab select-none items-center justify-center [touch-action:none]"
        >
          <div className="h-1 w-10 rounded-full bg-[var(--color-brand-border-strong)]" />
        </div>

        {showDisplay && (
          <div className="px-1.5 pb-3.5 pt-1">
            <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[.09em] text-[var(--color-brand-text-muted)]">{caption}</div>
            {isPin ? (
              <div className="flex items-center justify-center gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`size-3.5 rounded-full transition-transform ${i < value.length ? 'scale-100 bg-[var(--color-brand-primary)]' : 'scale-[.82] bg-[var(--color-brand-border-strong)]'}`}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-baseline justify-center gap-2">
                <span className="font-mono-numbers text-base font-semibold text-[var(--color-brand-text-muted)]">{currency}</span>
                <span className={`font-mono-numbers text-[42px] font-bold leading-none tracking-tight ${value ? 'text-[var(--color-brand-text-primary)]' : 'text-[var(--color-brand-text-muted)]/50'}`}>
                  {formatAmount(value)}
                </span>
              </div>
            )}
          </div>
        )}

        <div dir="ltr" className="grid grid-cols-3 gap-2">
          {keys.map((k, i) => {
            if (k === 'blank') return <span key={i} aria-hidden />
            if (k === 'back') {
              return (
                <button
                  key={i}
                  type="button"
                  className="np-key np-key-action"
                  onPointerDown={(e) => { e.preventDefault(); startBackspace() }}
                  onPointerUp={stopHold}
                  onPointerLeave={stopHold}
                  onPointerCancel={stopHold}
                  aria-label="Delete"
                >
                  <Delete size={24} strokeWidth={1.75} />
                </button>
              )
            }
            return (
              <button
                key={i}
                type="button"
                className="np-key"
                onPointerDown={(e) => { e.preventDefault(); press(k) }}
                aria-label={k === '.' ? 'Decimal point' : k}
              >
                {k}
              </button>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
