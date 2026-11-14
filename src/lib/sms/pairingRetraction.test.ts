import { describe, expect, it } from 'vitest'
import { reconcileCcPayoffFundingLeg, reconcileSibling, type PairSibling } from './pairing'
import type { ServiceClient } from '@/lib/supabase/service'

type Write = { table: string; values: Record<string, unknown>; id?: unknown }

function fakeService() {
  const writes: Write[] = []
  const service = {
    from: (table: string) => {
      let values: Record<string, unknown> | null = null
      const q: Record<string, unknown> = {
        select: () => q,
        update: (v: Record<string, unknown>) => ((values = v), q),
        eq: (_k: string, id: unknown) => {
          if (values) writes.push({ table, values, id })
          return q
        },
        maybeSingle: async () => ({ data: { amount: 100, account_last4: '1234' }, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      }
      return q
    },
  } as unknown as ServiceClient
  return { service, writes }
}

const LOG = '11111111-1111-4111-8111-111111111111'
const sibling = (over: Partial<PairSibling>): PairSibling =>
  ({ siblingId: '22222222-2222-4222-8222-222222222222', siblingKind: 'own_transfer', siblingExpenseId: null, siblingIncomeId: null, siblingStatus: 'posted', ...over }) as PairSibling

const retractions = (w: Write[], table: string) => w.filter((x) => x.table === table && 'deleted_at' in x.values)

describe('pairing retractions carry their cause (I4)', () => {
  it('reconcileSibling stamps the marker in the same update as deleted_at', async () => {
    const { service, writes } = fakeService()
    await reconcileSibling(service, sibling({ siblingIncomeId: 'inc-1' }), LOG)
    const r = retractions(writes, 'income_events')
    expect(r).toHaveLength(1)
    expect(r[0].values).toEqual({ deleted_at: expect.any(String), retracted_by_sms_log_id: LOG })
  })

  it('reconcileCcPayoffFundingLeg stamps the marker on the expense retraction', async () => {
    const { service, writes } = fakeService()
    await reconcileCcPayoffFundingLeg(service, sibling({ siblingExpenseId: 'exp-1' }), LOG)
    const r = retractions(writes, 'expenses')
    expect(r).toHaveLength(1)
    expect(r[0].values).toEqual({ deleted_at: expect.any(String), retracted_by_sms_log_id: LOG })
  })

  it('reconcileCcPayoffFundingLeg stamps the marker on the income retraction', async () => {
    const { service, writes } = fakeService()
    await reconcileCcPayoffFundingLeg(service, sibling({ siblingIncomeId: 'inc-1' }), LOG)
    const r = retractions(writes, 'income_events')
    expect(r).toHaveLength(1)
    expect(r[0].values).toEqual({ deleted_at: expect.any(String), retracted_by_sms_log_id: LOG })
  })
})
