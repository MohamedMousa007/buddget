'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { usePathname } from 'next/navigation'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { BuddgyMood } from '@/components/ai/BuddgyIcon'

export type BuddgyReaction = 'jump' | 'spin' | 'shake'

const SLEEP_AFTER_MS = 45_000
const NIGHT_SLEEP_AFTER_MS = 15_000
const LOOK_HOLD_MS = 1400

const isNight = () => {
  const h = new Date().getHours()
  return h >= 23 || h < 6
}

/**
 * The orb's ambient behaviour — what makes Buddgy feel present rather than a
 * static button. Everything is derived from what the user is already doing:
 *
 * - eyes glance toward wherever the user taps, and follow scroll direction;
 * - a new screen gets a curious look toward the content;
 * - logging an expense earns a happy hop;
 * - left alone, Buddgy dozes off (sooner at night) and wakes with a wink.
 *
 * Idle glances are random so the loop never reads as a loop.
 */
export function useBuddgyLife(anchorRef: RefObject<HTMLElement | null>, side: 'left' | 'right', paused: boolean) {
  const pathname = usePathname()
  const expenseCount = useFinanceStore((s) => s.expenses.length)
  const [mood, setMood] = useState<BuddgyMood>('awake')
  const [look, setLook] = useState({ x: 0, y: 0 })
  const lastActivity = useRef(0)
  const moodTimer = useRef<number | undefined>(undefined)
  const lookTimer = useRef<number | undefined>(undefined)
  const sleeping = mood === 'sleepy'
  const moodRef = useRef(mood)
  useEffect(() => { moodRef.current = mood }, [mood])

  const react = useCallback((kind: BuddgyReaction) => {
    const el = anchorRef.current
    if (!el) return
    el.classList.remove('bg-react-jump', 'bg-react-spin', 'bg-react-shake')
    void el.offsetWidth // restart the animation even when the same kind repeats
    el.classList.add(`bg-react-${kind}`)
  }, [anchorRef])

  const flash = useCallback((next: BuddgyMood, ms: number) => {
    window.clearTimeout(moodTimer.current)
    setMood(next)
    moodTimer.current = window.setTimeout(() => setMood('awake'), ms)
  }, [])

  const glance = useCallback((x: number, y: number, ms = LOOK_HOLD_MS) => {
    window.clearTimeout(lookTimer.current)
    setLook({ x, y })
    lookTimer.current = window.setTimeout(() => setLook({ x: 0, y: 0 }), ms)
  }, [])

  // Taps and scrolls anywhere: the user is here, and Buddgy looks where they act.
  useEffect(() => {
    lastActivity.current = Date.now()
    const scrollTops = new WeakMap<EventTarget, number>()
    const wake = () => {
      lastActivity.current = Date.now()
      if (moodRef.current !== 'sleepy') return
      moodRef.current = 'wink'
      react('jump')
      flash('wink', 1200)
    }
    const onPointer = (e: PointerEvent) => {
      wake()
      const r = anchorRef.current?.getBoundingClientRect()
      if (!r) return
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      const len = Math.hypot(dx, dy) || 1
      glance((dx / len) * 1.25, (dy / len) * 1)
    }
    const onScroll = (e: Event) => {
      wake()
      const el = e.target instanceof Element ? e.target : document.scrollingElement
      if (!el) return
      const prev = scrollTops.get(el) ?? el.scrollTop
      scrollTops.set(el, el.scrollTop)
      if (el.scrollTop !== prev) glance(0, el.scrollTop > prev ? 1 : -1, 600)
    }
    window.addEventListener('pointerdown', onPointer, { capture: true, passive: true })
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('keydown', wake, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onPointer, { capture: true })
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('keydown', wake)
    }
  }, [anchorRef, glance, react, flash])

  // Dozing off, and random idle glances while awake.
  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => {
      const idleFor = Date.now() - lastActivity.current
      if (idleFor > (isNight() ? NIGHT_SLEEP_AFTER_MS : SLEEP_AFTER_MS)) {
        window.clearTimeout(moodTimer.current)
        setMood('sleepy')
        setLook({ x: 0, y: 0 })
      } else if (!sleeping && Math.random() < 0.35) {
        glance((Math.random() * 2 - 1) * 1.25, (Math.random() - 0.5), 900)
      }
    }, 4000)
    return () => window.clearInterval(id)
  }, [paused, sleeping, glance])

  // A new screen: a curious look toward the content.
  const firstPath = useRef(true)
  useEffect(() => {
    if (firstPath.current) { firstPath.current = false; return }
    lastActivity.current = Date.now()
    // Deferred a frame so the new screen paints before Buddgy turns to look at it.
    const id = window.setTimeout(() => {
      flash('curious', 1300)
      glance(side === 'right' ? -1.25 : 1.25, 0)
    }, 16)
    return () => window.clearTimeout(id)
  }, [pathname, side, flash, glance])

  // Something got logged: celebrate it.
  const prevCount = useRef(expenseCount)
  useEffect(() => {
    const grew = expenseCount > prevCount.current
    prevCount.current = expenseCount
    if (!grew) return
    const id = window.setTimeout(() => {
      flash('happy', 1800)
      react('jump')
    }, 16)
    return () => window.clearTimeout(id)
  }, [expenseCount, flash, react])

  useEffect(() => () => {
    window.clearTimeout(moodTimer.current)
    window.clearTimeout(lookTimer.current)
  }, [])

  return { mood, look, react }
}
