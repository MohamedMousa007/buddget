'use client'

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform, animate } from 'framer-motion'
import { Check } from 'lucide-react'
import { syncFinanceNow } from '@/components/sync/SupabaseFinanceSync'

const THRESHOLD = 80 // px of resisted pull to commit a refresh
const MAX_PULL = 120 // px cap on how far the content follows the finger
const RESISTANCE = 0.5 // finger travel → content travel (rubber-band feel)

async function haptic() {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch {
    /* web / unsupported — no-op */
  }
}

/**
 * Standard threshold pull-to-refresh. Engages only when the scroll container is
 * already at the top; pulling down past THRESHOLD against resistance and
 * releasing runs a full server sync (`syncFinanceNow`). Touch-only — mouse
 * never fires these events, so desktop is excluded with no platform check.
 *
 * The native rubber-band is disabled app-wide (`overscroll-behavior: none`), so
 * this owns both the gesture and the visual feedback.
 */
export function PullToRefresh({
  scrollRef,
  children,
}: {
  scrollRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
}) {
  const pull = useMotionValue(0) // resisted pull distance (0..MAX_PULL)
  const [refreshing, setRefreshing] = useState(false)
  const [done, setDone] = useState(false)

  // Content follows the pull while dragging; during refresh it rests at THRESHOLD
  // so the spinner stays visible. Spring gives the release-snap its bounce.
  const contentY = useSpring(pull, { stiffness: 500, damping: 40 })

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let startY = 0
    let engaged = false // touch began at scroll-top and is pulling down
    let armed = false // crossed THRESHOLD (for the one-shot haptic)

    const onStart = (e: TouchEvent) => {
      if (refreshing) return
      // Engage only from the very top so normal scrolling is untouched.
      if (el.scrollTop > 0) { engaged = false; return }
      startY = e.touches[0].clientY
      engaged = true
      armed = false
    }

    const onMove = (e: TouchEvent) => {
      if (!engaged || refreshing) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0) {
        // Pulling back up / scrolling down — release control to the scroller.
        if (pull.get() === 0) { engaged = false }
        pull.set(0)
        return
      }
      // Actively pulling down from the top — take over from native scroll.
      e.preventDefault()
      const resisted = Math.min(dy * RESISTANCE, MAX_PULL)
      pull.set(resisted)
      const nowArmed = resisted >= THRESHOLD
      if (nowArmed && !armed) void haptic()
      armed = nowArmed
    }

    const onEnd = () => {
      if (!engaged || refreshing) return
      engaged = false
      if (pull.get() >= THRESHOLD) {
        setRefreshing(true)
        animate(pull, THRESHOLD, { stiffness: 500, damping: 40, type: 'spring' })
        void syncFinanceNow().finally(() => {
          setRefreshing(false)
          setDone(true)
          animate(pull, 0, { stiffness: 500, damping: 40, type: 'spring' })
          window.setTimeout(() => setDone(false), 700)
        })
      } else {
        animate(pull, 0, { stiffness: 500, damping: 40, type: 'spring' })
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [scrollRef, refreshing, pull])

  return (
    <>
      <Indicator pull={pull} refreshing={refreshing} done={done} />
      <motion.div style={{ y: contentY }}>{children}</motion.div>
    </>
  )
}

function Indicator({
  pull,
  refreshing,
  done,
}: {
  pull: ReturnType<typeof useMotionValue<number>>
  refreshing: boolean
  done: boolean
}) {
  // Ring progress 0→1 as pull approaches THRESHOLD.
  const progress = useTransform(pull, [0, THRESHOLD], [0, 1], { clamp: true })
  const CIRC = 2 * Math.PI * 9 // r=9
  const dashOffset = useTransform(progress, (p) => CIRC * (1 - p))
  // The badge rides down with the pull, centered under the header.
  const badgeY = useTransform(pull, (p) => Math.min(p, MAX_PULL))
  const opacity = useTransform(pull, [0, 24], [0, 1], { clamp: true })
  const scale = useTransform(pull, [0, THRESHOLD], [0.7, 1], { clamp: true })

  return (
    <motion.div
      aria-hidden
      style={{ y: badgeY, opacity: refreshing || done ? 1 : opacity, scale: refreshing || done ? 1 : scale }}
      className="pointer-events-none absolute inset-x-0 top-[calc(52px+env(safe-area-inset-top,0px))] lg:top-12 z-10 flex -translate-y-1/2 justify-center"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-card)] shadow-md ring-1 ring-[var(--color-brand-border)]">
        {done ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          >
            <Check className="h-4 w-4 text-[var(--color-brand-green)]" />
          </motion.span>
        ) : refreshing ? (
          <motion.svg
            width="22" height="22" viewBox="0 0 22 22"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, ease: 'linear', duration: 0.8 }}
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
      </div>
    </motion.div>
  )
}
