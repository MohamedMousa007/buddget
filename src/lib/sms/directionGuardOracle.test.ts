import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSmsTransaction } from './dispatch'
import type { SmsRowData } from './createSmsExpense'

/**
 * N1 — the direction guard as a template-health oracle.
 *
 * `guardDirection` runs on every parse tier. When it has to OVERRIDE a template-parsed row, the
 * bank's own ledger sign has contradicted the template's `kind`, so that template is provably
 * wrong. Until this landed the guard silently corrected such rows, which meant a defective
 * template kept a clean record while the guard quietly cleaned up after it on every message.
 *
 * The oracle is free (no AI, no user, no extra query) and near-certain, so one hit quarantines.
 * It must fire ONLY when a DB template produced the row — a curated or AI parse has no template
 * to blame, and blaming one would be attributing a defect to innocent rows.
 */

/** The real capture that started all of this: an inbound wire the AI read as outgoing. */
const INBOUND_WIRE =
  'From HSBC: 20JUL26 TT Payment to 103-104***-110 USD 3,097.24+ Your available balance is USD 7,546.11'

function makeService() {
  const rpc = vi.fn(async () => ({ data: [], error: null }))

  // Minimal query chain: everything resolves empty so dispatch takes the simplest path and we
  // only observe the RPC the oracle fires.
  const chain = (): Record<string, unknown> => {
    const self: Record<string, unknown> = {}
    const methods = ['select', 'eq', 'is', 'in', 'not', 'gte', 'lte', 'order', 'limit', 'update', 'insert']
    for (const m of methods) self[m] = () => self
    self.maybeSingle = async () => ({ data: null, error: null })
    self.single = async () => ({ data: { id: 'e1' }, error: null })
    self.then = (res: (v: unknown) => unknown) => res({ data: [], error: null })
    return self
  }

  const service = { from: () => chain(), rpc } as unknown as SupabaseClient
  return { service, rpc }
}

const row = (over: Partial<SmsRowData>): SmsRowData => ({
  userId: 'u1',
  amount: 3097.24,
  currency: 'USD',
  day: '2026-07-20',
  // What the AI said: money going OUT. The trailing "+" says otherwise.
  kind: 'instant_transfer_out',
  cleanTitle: 'Transfer to 103-104***-110',
  merchantNormalized: null,
  merchant: null,
  bankName: 'HSBC Egypt',
  categoryHint: null,
  source: 'sms',
  rawBody: INBOUND_WIRE,
  ...over,
})

const opts = { exchangeRates: {} }

describe('directionGuard as a template-health oracle', () => {
  it('reports a hard failure when it overrides a TEMPLATE-parsed row', async () => {
    const { service, rpc } = makeService()
    await createSmsTransaction(service, row({ matchedTemplateId: 'tpl-1' }), opts)

    const call = rpc.mock.calls.find((c) => c[0] === 'bump_sms_template_failure')
    expect(call, 'oracle did not fire').toBeDefined()
    expect(call![1]).toMatchObject({ p_template_id: 'tpl-1', p_hard: true })
    expect(String((call![1] as Record<string, unknown>).p_reason)).toContain('direction_guard_override')
  })

  it('stays silent for a curated or AI parse — there is no template to blame', async () => {
    const { service, rpc } = makeService()
    await createSmsTransaction(service, row({ matchedTemplateId: null }), opts)
    expect(rpc.mock.calls.find((c) => c[0] === 'bump_sms_template_failure')).toBeUndefined()
  })

  it('stays silent when the template got the direction right', async () => {
    const { service, rpc } = makeService()
    // Same message, and the template already called it inbound — nothing to override.
    await createSmsTransaction(
      service,
      row({ matchedTemplateId: 'tpl-1', kind: 'instant_transfer_in' }),
      opts,
    )
    expect(rpc.mock.calls.find((c) => c[0] === 'bump_sms_template_failure')).toBeUndefined()
  })

  it('never lets health accounting break the transaction it observes', async () => {
    const { service } = makeService()
    // The oracle's RPC throwing must not propagate — the user's transaction still matters more.
    const throwing = {
      ...service,
      rpc: vi.fn(async (name: string) => {
        if (name === 'bump_sms_template_failure') throw new Error('db down')
        return { data: [], error: null }
      }),
    } as unknown as SupabaseClient
    await expect(
      createSmsTransaction(throwing, row({ matchedTemplateId: 'tpl-1' }), opts),
    ).resolves.toBeDefined()
  })
})
