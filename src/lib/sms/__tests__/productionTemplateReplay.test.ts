import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runLearnGates } from '../learnGates'
import { applyMappingRules, type MappingRules } from '../templateApply'

/**
 * Corpus replay — every real template currently live in `sms_tracking_templates_ai`, run
 * through the learn-time gates against the exact sample it was learned from.
 *
 * This is the safety net for the gates themselves. They are deliberately strict, and a gate
 * that is *too* strict is invisible in unit tests written alongside it — it only shows up when
 * real production templates start being rejected. If tightening a gate breaks a template that
 * has been parsing correctly in production, this test fails immediately.
 *
 * Regenerate the fixture from the DB when the template set changes materially.
 */
interface Fixture {
  id: string
  sender: string
  rx: string
  rules: MappingRules
  sample: string
  amount: number
  currency: string | null
  last4: string | null
}

const FIXTURES: Fixture[] = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/productionTemplates.json'), 'utf-8'),
)

describe('production template replay', () => {
  it('loaded the fixture', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(9)
  })

  it.each(FIXTURES.map((f) => [`${f.sender} (${f.id})`, f] as const))(
    '%s — extracts the expected values',
    (_label, f) => {
      const got = applyMappingRules(f.sample, f.rx, f.rules)
      expect(got, 'regex did not match its own sample').not.toBeNull()
      expect(got!.amount).toBeCloseTo(f.amount, 2)
      if (f.last4) expect(got!.last4).toBe(f.last4)
      if (f.currency) expect(got!.currency?.toUpperCase()).toBe(f.currency)
    },
  )

  it.each(FIXTURES.map((f) => [`${f.sender} (${f.id})`, f] as const))(
    '%s — passes every learn-time gate',
    (_label, f) => {
      const res = runLearnGates(f.sample, f.rx, f.rules, {
        amount: f.amount,
        currency: f.currency,
        detectedAccountLast4: f.last4,
      })
      // A failure here means a gate is too strict for a template that works in production.
      expect(res, res.ok ? '' : `rejected: ${JSON.stringify(res)}`).toEqual({ ok: true })
    },
  )

  it('none of the live templates capture their amount from a balance clause', () => {
    // The defect class the wrong-token gate exists to prevent. Several of these samples end
    // with a balance ("your available bal.EGP3049.67", "الحالي 548.2"), so this is a real check.
    for (const f of FIXTURES) {
      const res = runLearnGates(f.sample, f.rx, f.rules, {
        amount: f.amount,
        currency: f.currency,
        detectedAccountLast4: f.last4,
      })
      if (!res.ok) expect(res.status).not.toBe('gate_wrong_token_balance')
    }
  })
})
