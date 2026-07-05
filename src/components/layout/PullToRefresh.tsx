'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { syncFinanceNow } from '@/components/sync/SupabaseFinanceSync'
import { useT } from '@/lib/i18n'
import { THRESHOLD, resistedPull, canEngage } from './pullToRefreshLogic'

const REST = 56 // px below the header the spinner rests at while syncing
const MIN_SPIN = 220 // just enough that a sub-frame sync doesn't flash — no artificial dwell
const SYNC_TIMEOUT = 6000 // never let the spinner hang "forever"
const DONE_MS = 550 // brief "Refreshed!" confirmation, then out

async function haptic() {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch {
    /* web / unsupported — no-op */
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Pull-to-refresh. The page scrolls on the WINDOW (main isn't a scroll
 * container), so "at top" is `window.scrollY <= 0`. The gesture must BEGIN at
 * the top: a hard flick that scrolls up to the top ends with the finger lifted,
 * so triggering a refresh needs a fresh second swipe from the top — it can
 * never fire on the same swipe that scrolled up (BUD-57).
 *
 * The indicator is a fixed overlay anchored just below the app header with a
 * high z-index, so it never drags a sticky sub-header and is never clipped.
 * Touch-only — mouse never fires these events, so desktop is excluded.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const t = useT()
  const y = useMotionValue(0) // indicator offset below the header
  const [phase, setPhase] = useState<'idle' | 'pull' | 'refreshing' | 'done'>('idle')

  useEffect(() => {
    let startY = 0
    let engaged = false // gesture began at the top and is a downward pull
    let armed = false // crossed THRESHOLD (one-shot haptic)
    let active = false // a refresh cycle is running

    const atTop = () => canEngage(window.scrollY || document.documentElement.scrollTop || 0)

    const onStart = (e: TouchEvent) => {
      if (active || e.touches.length !== 1 || !atTop()) { engaged = false; return }
      startY = e.touches[0].clientY
      engaged = true
      armed = false
    }

    const onMove = (e: TouchEvent) => {
      if (!engaged || active) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0) {
        // Not pulling down (scrolling up / settling) — hand back to the scroller.
        engaged = false
        if (y.get() !== 0) animate(y, 0, { type: 'spring', stiffness: 600, damping: 40 })
        setPhase('idle')
        return
      }
      // Genuine downward pull from the very top — take over from native scroll.
      e.preventDefault()
      const resisted = resistedPull(dy)
      y.set(resisted)
      setPhase('pull')
      const nowArmed = resisted >= THRESHOLD
      if (nowArmed && !armed) void haptic()
      armed = nowArmed
    }

    const finish = () => {
      setPhase('idle')
      animate(y, 0, { type: 'spring', stiffness: 600, damping: 40 })
    }

    const onEnd = () => {
      if (!engaged || active) return
      engaged = false
      if (y.get() < THRESHOLD) { finish(); return }
      // Commit: snap the spinner to its resting spot and sync.
      active = true
      setPhase('refreshing')
      animate(y, REST, { type: 'spring', stiffness: 600, damping: 38 })
      void (async () => {
        const started = Date.now()
        try {
          await Promise.race([syncFinanceNow(), sleep(SYNC_TIMEOUT)])
        } catch { /* best-effort; next auto-flush retries */ }
        const elapsed = Date.now() - started
        if (elapsed < MIN_SPIN) await sleep(MIN_SPIN - elapsed)
        setPhase('done')
        await sleep(DONE_MS)
        active = false
        finish()
      })()
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [y])

  return (
    <>
      <Indicator y={y} phase={phase} label={t.common.refreshed} />
      {children}
    </>
  )
}

function Indicator({
  y,
  phase,
  label,
}: {
  y: ReturnType<typeof useMotionValue<number>>
  phase: 'idle' | 'pull' | 'refreshing' | 'done'
  label: string
}) {
  const progress = useTransform(y, [0, THRESHOLD], [0, 1], { clamp: true })
  const CIRC = 2 * Math.PI * 9
  const dashOffset = useTransform(progress, (p) => CIRC * (1 - p))
  const opacity = useTransform(y, [0, 20], [0, 1], { clamp: true })
  const scale = useTransform(y, [0, THRESHOLD], [0.6, 1], { clamp: true })

  const showDone = phase === 'done'

  return (
    <motion.div
      aria-hidden={phase === 'idle'}
      style={{
        y,
        opacity: phase === 'refreshing' || phase === 'done' ? 1 : opacity,
        scale: phase === 'refreshing' || phase === 'done' ? 1 : scale,
      }}
      className="pointer-events-none fixed inset-x-0 top-[calc(52px+env(safe-area-inset-top,0px))] lg:top-12 z-[60] flex justify-center"
    >
      <AnimatePresence mode="wait" initial={false}>
        {showDone ? (
          <motion.div
            key="done"
            initial={{ scale: 0.7, opacity: 0, y: -6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -6 }}
            transition={{ type: 'spring', stiffness: 520, damping: 22 }}
            className="rounded-full bg-[var(--color-brand-green)] px-4 py-1.5 text-sm font-semibold text-white shadow-lg"
          >
            {label}
          </motion.div>
        ) : (
          <motion.div
            key="ring"
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-card)] shadow-md ring-1 ring-[var(--color-brand-border)]"
          >
            {phase === 'refreshing' ? (
              <motion.svg
                width="22" height="22" viewBox="0 0 22 22"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, ease: 'linear', duration: 0.7 }}
              >
                <circle cx="11" cy="11" r="9" fill="none" stroke="var(--color-brand-border)" strokeWidth="2.5" />
                <circle
                  cx="11" cy="11" r="9" fill="none" stroke="var(--color-brand-red)" strokeWidth="2.5"
                  strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * 0.7}
                />
              </motion.svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 22 22" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="11" cy="11" r="9" fill="none" stroke="var(--color-brand-border)" strokeWidth="2.5" />
                <motion.circle
                  cx="11" cy="11" r="9" fill="none" stroke="var(--color-brand-red)" strokeWidth="2.5"
                  strokeLinecap="round" strokeDasharray={CIRC} style={{ strokeDashoffset: dashOffset }}
                />
              </svg>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
