'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import type { AllocationRun } from '@/lib/goals/goalStatus'

/** Completed funding cycles per goal (behind / streak history). Empty offline or before the first run. */
export function useGoalAllocationRuns(): Record<string, AllocationRun[]> {
  const { user } = useAuth()
  const [runs, setRuns] = useState<Record<string, AllocationRun[]>>({})
  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    let cancelled = false
    createClient()
      .from('goal_allocation_runs')
      .select('goal_id, period, planned, amount')
      .eq('user_id', uid)
      .then(({ data }) => {
        if (cancelled || !data) return
        const by: Record<string, AllocationRun[]> = {}
        for (const r of data) {
          ;(by[r.goal_id] ??= []).push({ period: r.period, planned: Number(r.planned), amount: Number(r.amount) })
        }
        setRuns(by)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])
  return runs
}
