import { describe, it, expect } from 'vitest'
import { parseSmsDay } from '../patterns'

/**
 * Parity between a code pattern (`Fully Curated`) and a DB template (`Curated DB` / `Template`).
 *
 * Before this, `mapping_rules` had no `datetime` / `counterparty_last4` / `payment_instrument`,
 * so a template-parsed SMS was **dated by arrival** rather than by the date printed in the
 * message, and `detectedCounterpartyLast4` was always null — which meant dispatch's own-account
 * transfer detection could never fire for a template-parsed row. Promoting a template to
 * "Curated DB" therefore did not make it equal to Fully Curated.
 *
 * These tests pin the shared date parser the template tier now reuses, in every format the
 * real corpus contains.
 */
describe('parseSmsDay — shared by the code and template tiers', () => {
  it('parses the Egyptian bank formats', () => {
    expect(parseSmsDay('20-07-2026')).toBe('2026-07-20')
    expect(parseSmsDay('23/07/2026')).toBe('2026-07-23')
    expect(parseSmsDay('23/07/26')).toBe('2026-07-23')
  })

  it('parses the HSBC statement format', () => {
    expect(parseSmsDay('20JUL26')).toBe('2026-07-20')
    expect(parseSmsDay('9JUL26')).toBe('2026-07-09')
    expect(parseSmsDay('13JUN2026')).toBe('2026-06-13')
  })

  it('is case-insensitive on the month token', () => {
    expect(parseSmsDay('20jul26')).toBe('2026-07-20')
  })

  it('returns null rather than guessing when there is no date', () => {
    expect(parseSmsDay(null)).toBeNull()
    expect(parseSmsDay('')).toBeNull()
    expect(parseSmsDay('not a date')).toBeNull()
  })

  it('rejects impossible dates instead of emitting a bad ISO string', () => {
    expect(parseSmsDay('32-07-2026')).toBeNull()
    expect(parseSmsDay('20-13-2026')).toBeNull()
    expect(parseSmsDay('40JUL26')).toBeNull()
    expect(parseSmsDay('20XXX26')).toBeNull()
  })
})

/**
 * `mapping_rules` is stored as JSONB written by the AI, so its shape is a contract, not a type.
 * These assert the contract the route's `applyTemplate` now reads.
 */
describe('mapping_rules contract', () => {
  type MappingRules = {
    amount: { group: number; removeCommas?: boolean }
    currency?: { group: number } | { literal: string }
    last4?: { group: number }
    datetime?: { group: number }
    counterparty_last4?: { group: number }
    payment_instrument?: { literal: string }
    kind: string
  }

  // A real HSBC IPN outward transfer: source account, counterparty account, and a date.
  const BODY =
    'Your HSBC Account ********0001 was debited with IPN outward transfer for EGP 3.50 on 20-07-2026 03:33 to ****5124 with reference 15ad88c8.'
  const REGEX =
    /Account\s+([\d*\-]+)\s+was\s+debited\s+with\s+IPN\s+outward\s+transfer\s+for\s+([A-Z]{3})\s+([\d,]+\.?\d*)\s+on\s+(\d{2}-\d{2}-\d{4})\s+[\d:]*\s*to\s+([\d*\-]+)/

  const rules: MappingRules = {
    amount: { group: 3, removeCommas: true },
    currency: { group: 2 },
    last4: { group: 1 },
    datetime: { group: 4 },
    counterparty_last4: { group: 5 },
    payment_instrument: { literal: 'account' },
    kind: 'instant_transfer_out',
  }

  it('extracts every field a code pattern would, including the two that were unreachable', () => {
    const m = REGEX.exec(BODY)
    expect(m).not.toBeNull()

    const last4 = m![rules.last4!.group].replace(/\D/g, '').slice(-4)
    const cpLast4 = m![rules.counterparty_last4!.group].replace(/\D/g, '').slice(-4)
    const amount = parseFloat(m![rules.amount.group].replace(/,/g, ''))
    const txDay = parseSmsDay(m![rules.datetime!.group])

    expect(amount).toBe(3.5)
    expect(last4).toBe('0001')
    // Previously always null → own-account transfer detection could never fire.
    expect(cpLast4).toBe('5124')
    // Previously unset → the row was dated by arrival, not by the SMS.
    expect(txDay).toBe('2026-07-20')
    expect(rules.payment_instrument!.literal).toBe('account')
  })

  it('tolerates a template that captures none of the optional fields', () => {
    const minimal: MappingRules = { amount: { group: 1 }, kind: 'purchase' }
    expect(minimal.datetime).toBeUndefined()
    expect(minimal.counterparty_last4).toBeUndefined()
    // The route must fall back to arrival dating rather than throw.
    expect(parseSmsDay(null)).toBeNull()
  })
})
