import { describe, it, expect } from 'vitest'
import { flushDiff } from '@/lib/supabase/remote/sync'
import { emptySnapshot } from '@/lib/supabase/remote/snapshot'
import type { BudgetPlanActivation } from '@/lib/store/types'

const act = (id: string): BudgetPlanActivation => ({ id, planId: 'plan-1', effectiveFrom: '2026-10-01', createdAt: '2026-10-01T00:00:00Z' })

function recordingClient(log: string[]) {
  const done = { error: null }
  return {
    from: (table: string) => ({
      upsert: (rows: unknown[]) => {
        if (table === 'budget_plan_activations') log.push(`upsert:${(rows as { id: string }[]).map((r) => r.id).join(',')}`)
        return Promise.resolve(done)
      },
      update: () => ({
        in: (_col: string, ids: string[]) => {
          if (table === 'budget_plan_activations') log.push(`tombstone:${ids.join(',')}`)
          return Promise.resolve(done)
        },
      }),
    }),
  }
}

describe('flushDiff activations', () => {
  it('tombstones the replaced activation before inserting the one that takes its cycle', async () => {
    const log: string[] = []
    const prev = { ...emptySnapshot(), budgetPlanActivations: [act('old')] }
    const next = { ...emptySnapshot(), budgetPlanActivations: [act('new')] }
    const res = await flushDiff(recordingClient(log) as never, 'user-1', prev, next)
    expect(res.anyError).toBe(false)
    expect(log).toEqual(['tombstone:old', 'upsert:new'])
  })
})
