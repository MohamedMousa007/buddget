'use client'

import { useEffect, useRef } from 'react'
import { useT } from '@/lib/i18n'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useBuddgyIdeaContext } from '@/hooks/useBuddgyIdeaContext'
import { buddgyNudge, nudgeAllowed, NUDGE_RULES, type BuddgyNudge } from '@/lib/ai/buddgyIdeas'

/**
 * Decides when Buddgy speaks up. Rendered only while tips are switched on, so
 * the month stats it reads aren't computed for users who turned tips off.
 *
 * A tip waits for the user to settle on a screen, never interrupts a sheet,
 * and respects the daily cap and gap in {@link NUDGE_RULES}.
 */
export function BuddgyNudgeWatcher({ blocked, onNudge }: { blocked: boolean; onNudge: (n: BuddgyNudge) => void }) {
  const t = useT()
  const ctx = useBuddgyIdeaContext()
  const candidate = buddgyNudge(ctx, t.buddgy)
  const latest = useRef(candidate)
  const onNudgeRef = useRef(onNudge)
  useEffect(() => {
    latest.current = candidate
    onNudgeRef.current = onNudge
  })

  useEffect(() => {
    if (!candidate || blocked) return
    const id = window.setTimeout(() => {
      const n = latest.current
      const { buddgyNudgeLog, logBuddgyNudge } = useSettingsStore.getState()
      if (!n || document.hidden || !nudgeAllowed(buddgyNudgeLog, n.id, new Date())) return
      logBuddgyNudge(n.id)
      onNudgeRef.current(n)
    }, NUDGE_RULES.dwellMs)
    return () => window.clearTimeout(id)
    // Re-arm per screen and per distinct tip, not on every stats recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.screen, candidate?.id, blocked])

  return null
}
