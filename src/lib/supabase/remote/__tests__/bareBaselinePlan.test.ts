import { describe, it, expect } from 'vitest'
import { flushDiff } from '@/lib/supabase/remote/sync'
import { emptySnapshot } from '@/lib/supabase/remote/snapshot'
import type { BudgetPlan } from '@/lib/store/types'

function recordingClient(log: string[]) {
  const done = { error: null }
  return {
    from: (table: string) => ({
      upsert: () => Promise.resolve(done),
      update: () => ({
        in: (_col: string, ids: string[]) => {
          log.push(`${table}:${ids.join(',')}`)
          return Promise.resolve(done)
        },
      }),
    }),
  }
}

// A baseline rebuilt from the flushed fingerprint holds a deleted plan as a bare { id } row (flushedFingerprint.ts).
describe('flushDiff with a bare baseline plan', () => {
  it('tombstones the plan instead of throwing on its missing categories', async () => {
    const log: string[] = []
    const prev = { ...emptySnapshot(), budgetPlans: [{ id: 'plan-gone' } as unknown as BudgetPlan] }
    const res = await flushDiff(recordingClient(log) as never, 'user-1', prev, emptySnapshot())
    expect(res.anyError).toBe(false)
    expect(log).toContain('budget_plans:plan-gone')
  })
})
