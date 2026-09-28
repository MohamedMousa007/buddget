'use client'

import { useEffect, useMemo } from 'react'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { BuddgyMood } from '@/components/ai/BuddgyIcon'

/**
 * Priority order from the handoff (README §3). The first mood that is currently
 * active wins, so independent callers never have to coordinate: a finished OCR
 * scan cannot clear an `offline` state it did not set.
 */
const PRIORITY: readonly BuddgyMood[] = [
  'offline', 'error', 'listening', 'scanning', 'thinking', 'alert', 'done', 'happy', 'idle',
] as const

/** One-shot moods that return to idle on their own, and after how long. */
const AUTO_CLEAR: Partial<Record<BuddgyMood, number>> = {
  done: 1600,
  happy: 2000,
  error: 2000,
}

/** The mood Buddgy should currently show. */
export function useBuddgyMood(): BuddgyMood {
  const active = useSettingsStore((s) => s.buddgyActive)
  const setBuddgyMood = useSettingsStore((s) => s.setBuddgyMood)

  // Offline is driven by the browser, not by a caller, so own it here.
  useEffect(() => {
    const sync = () => setBuddgyMood('offline', !navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [setBuddgyMood])

  // Self-clearing one-shots. Each timer is keyed to the mood that set it, so a
  // mood re-entered before its timer fires restarts the clock rather than being
  // cleared early by the previous one.
  useEffect(() => {
    const timers = Object.entries(AUTO_CLEAR)
      .filter(([mood]) => active[mood as BuddgyMood])
      .map(([mood, ms]) =>
        window.setTimeout(() => setBuddgyMood(mood as BuddgyMood, false), ms),
      )
    return () => timers.forEach(window.clearTimeout)
  }, [active, setBuddgyMood])

  return useMemo(() => PRIORITY.find((m) => active[m]) ?? 'idle', [active])
}

/**
 * Setter for surfaces that drive a mood. Returns a stable callback.
 *
 * ```ts
 * const setMood = useSetBuddgyMood()
 * setMood('scanning', true)   // OCR started
 * setMood('scanning', false)  // …finished
 * setMood('done', true)       // clears itself after 1.6s
 * ```
 */
export function useSetBuddgyMood() {
  return useSettingsStore((s) => s.setBuddgyMood)
}

/**
 * Declaratively bind a mood to a condition that already exists in a component.
 *
 * Self-clearing: when `active` goes false — or the component unmounts mid-flight,
 * which is the common case for a sheet that is closed while still parsing — the
 * mood is released. Without the unmount cleanup Buddgy would stay stuck
 * "scanning" forever.
 *
 * ```ts
 * useBuddgyMoodWhile('scanning', state === 'scanning' || state === 'parsing')
 * ```
 */
export function useBuddgyMoodWhile(mood: BuddgyMood, active: boolean): void {
  const setBuddgyMood = useSettingsStore((s) => s.setBuddgyMood)
  useEffect(() => {
    setBuddgyMood(mood, active)
    return () => setBuddgyMood(mood, false)
  }, [mood, active, setBuddgyMood])
}

/**
 * Fire a one-shot mood (done / happy / error) once, when `trigger` flips true.
 * The mood clears itself on the timer in AUTO_CLEAR.
 */
export function useBuddgyMoodOnce(mood: BuddgyMood, trigger: boolean): void {
  const setBuddgyMood = useSettingsStore((s) => s.setBuddgyMood)
  useEffect(() => {
    if (trigger) setBuddgyMood(mood, true)
  }, [mood, trigger, setBuddgyMood])
}

/** Human-readable state for the `aria-live` region beside the orb. */
export function buddgyStatusText(mood: BuddgyMood): string | null {
  switch (mood) {
    case 'listening': return 'Buddgy is listening'
    case 'thinking': return 'Buddgy is thinking'
    case 'scanning': return 'Buddgy is reading that'
    case 'error': return "Buddgy couldn't do that"
    case 'offline': return 'Buddgy is offline'
    default: return null
  }
}
