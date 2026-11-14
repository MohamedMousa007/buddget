import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceClient } from '@/lib/supabase/service'
import { checkAndAutoPromote, invalidateConfigCache } from './promotionChecker'
import type { ReplayCase } from './replayHarness'

vi.mock('@/lib/sms/curatedDbCache', () => ({ invalidateCuratedDbCache: vi.fn() }))

const TEMPLATE = {
  regex_pattern: 'Spent (\\d+) EGP',
  mapping_rules: { amount: { group: 1 }, currency: { literal: 'EGP' }, kind: 'purchase' },
}

function makeService() {
  const updates: unknown[] = []
  const service = {
    rpc: vi.fn(async () => ({ data: [{ template_id: 'tpl-1', sender: 'BANK' }] })),
    from: (table: string) => {
      if (table === 'sms_promotion_config') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { min_match_count: 1, min_unique_users: 1, min_age_days: 0, max_failure_rate: 1, min_avg_confidence: 0 } }) }) }) }
      }
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: TEMPLATE }) }) }),
        update: (v: unknown) => { updates.push(v); return { eq: async () => ({ error: null }) } },
      }
    },
  } as unknown as ServiceClient
  return { service, updates }
}

const mustNotMatch: ReplayCase = { id: 'shape-1', body: 'Spent 99 EGP', expect: { matches: false } }

describe('checkAndAutoPromote replay check', () => {
  beforeEach(() => invalidateConfigCache())

  it('blocks promotion when the template matches a shape that must not match', async () => {
    const { service, updates } = makeService()
    await checkAndAutoPromote('BANK', service, { loadReplayCases: async () => [mustNotMatch] })
    expect(updates).toHaveLength(0)
  })

  it('promotes when the replay finds no regression', async () => {
    const { service, updates } = makeService()
    await checkAndAutoPromote('BANK', service, { loadReplayCases: async () => [{ id: 'shape-2', body: 'Other wording 10', expect: { matches: false } }] })
    expect(updates).toHaveLength(1)
  })

  it('a loader that throws means no cases: promotion is not blocked', async () => {
    const { service, updates } = makeService()
    await checkAndAutoPromote('BANK', service, { loadReplayCases: async () => { throw new Error('db down') } })
    expect(updates).toHaveLength(1)
  })

  it('no loader supplied keeps the old behaviour', async () => {
    const { service, updates } = makeService()
    await checkAndAutoPromote('BANK', service)
    expect(updates).toHaveLength(1)
  })
})
