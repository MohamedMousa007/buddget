'use client'

import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useActionToast } from '@/components/ui/ActionToast'
import { useT } from '@/lib/i18n'
import type { Goal } from '@/lib/store/types'

/**
 * Shows a toast when a goal transitions from active to achieved (store reconcile or manual).
 */
export function GoalAchievementListener() {
  const goals = useFinanceStore(useShallow((s) => s.goals))
  const showToast = useActionToast()
  const t = useT()
  const prev = useRef<Map<string, Goal['status']> | null>(null)

  useEffect(() => {
    if (prev.current === null) {
      const m = new Map<string, Goal['status']>()
      goals.forEach((g) => m.set(g.id, g.status))
      prev.current = m
      return
    }
    for (const g of goals) {
      const before = prev.current.get(g.id)
      if (before === 'active' && g.status === 'achieved') {
        showToast(t.goals.celebration(g.name))
      }
      prev.current.set(g.id, g.status)
    }
    for (const id of prev.current.keys()) {
      if (!goals.some((g) => g.id === id)) prev.current.delete(id)
    }
  }, [goals, showToast, t.goals])

  return null
}
