'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'

export type SharedPlanMembership =
  | { kind: 'owner' }
  | { kind: 'member'; role: string; syncTransactions: boolean }

export type SharedPlanSummary = {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
  membership: SharedPlanMembership
}

/**
 * Loads shared budget plans from `/api/budget/plans` and exposes create/refresh helpers.
 */
export function useSharedBudgets() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<SharedPlanSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setPlans([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/budget/plans', { method: 'GET' })
      if (!res.ok) {
        setError('Could not load shared plans')
        setPlans([])
        return
      }
      const data = (await res.json()) as { plans?: SharedPlanSummary[] }
      setPlans(data.plans ?? [])
    } catch {
      setError('Could not load shared plans')
      setPlans([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createSharedPlan = useCallback(async (name?: string) => {
    const res = await fetch('/api/budget/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name?.trim() }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { plan?: SharedPlanSummary }
    void refresh()
    return data.plan ?? null
  }, [refresh])

  return { plans, loading, error, refresh, createSharedPlan }
}
