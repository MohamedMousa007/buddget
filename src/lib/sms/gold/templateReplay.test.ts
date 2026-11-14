import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { replayTemplate, replayVerdict, type ReplayRow, type ReplayTemplate } from './templateReplay'

// Synthetic template and messages only.
const tpl = (over: Partial<ReplayTemplate> = {}): ReplayTemplate => ({
  id: 't1', sender: 'BANK', tier: 'template', status: 'active', ai_enabled: true, match_count: 20, users: 1, failures: 0, hard_fail: false, age_days: 30,
  contributors: ['author'],
  regex: 'Purchase of (EGP) ([\\d,.]+) at (.+?) on card \\*+(\\d{4})',
  rules: { amount: { group: 2 }, currency: { group: 1 }, merchant: { group: 3 }, last4: { group: 4 }, kind: 'purchase' },
  ...over,
})
const row = (over: Partial<ReplayRow> = {}): ReplayRow => ({
  id: 'r', u: 'other', raw: 'Purchase of EGP 120.50 at SHOP on card ****1234', mb: null, ok: true, st: 'confirmed', fc: null, pm: 'ai_new',
  k: 'purchase', a: 120.5, c: 'EGP', t: '1234', tid: null, dup: false, ...over,
})

describe('replayTemplate', () => {
  it('counts an independent agreeing reading from a held-out user', () => {
    const ev = replayTemplate(tpl(), [row()])
    expect(ev).toMatchObject({ matched: 1, heldOutUsers: 1, independent: 1, comparedExact: 1, falsePositives: 0 })
    expect(ev.disagreements).toEqual({ amount: 0, direction: 0, currency: 0, digits: 0 })
  })

  it("does not count the template's own rows as evidence about it", () => {
    expect(replayTemplate(tpl(), [row({ tid: 't1', u: 'author' })])).toMatchObject({ matched: 1, heldOutUsers: 0, independent: 0 })
  })

  it.each([
    ['amount', { a: 99 }],
    ['currency', { c: 'USD' }],
    ['digits', { t: '9999' }],
    ['direction', { k: 'income' }],
  ])('records a %s disagreement with the other tier', (field, over) => {
    expect(replayTemplate(tpl(), [row(over)]).disagreements[field as 'amount']).toBe(1)
  })

  it('counts a match on a non-transaction as a false positive, and ignores a failed row', () => {
    expect(replayTemplate(tpl(), [row({ ok: false, k: null, st: 'rejected', fc: 'not_transaction' })]).falsePositives).toBe(1)
    expect(replayTemplate(tpl(), [row({ ok: false, k: null, st: 'failed', fc: 'gemini_error' })]).falsePositives).toBe(0)
  })

  it('on a masked shape compares direction and currency but not amount or digits', () => {
    const ev = replayTemplate(tpl(), [row({ raw: null, mb: 'Purchase of EGP #.# at SHOP on card ****####', a: 5, t: '0000' })])
    expect(ev).toMatchObject({ matched: 1, independent: 1, comparedExact: 0 })
    expect(ev.disagreements).toEqual({ amount: 0, direction: 0, currency: 0, digits: 0 })
  })
})

describe('replayVerdict', () => {
  const clean = { id: 't1', matched: 5, heldOutUsers: 2, independent: 3, comparedExact: 3, falsePositives: 0, disagreements: { amount: 0, direction: 0, currency: 0, digits: 0 }, kindDiffers: 0 }
  it('passes only a clean, active template with enough independent evidence', () => {
    expect(replayVerdict(tpl(), clean)).toEqual({ pass: true })
    expect(replayVerdict(tpl(), { ...clean, independent: 2 }).pass).toBe(false)
    expect(replayVerdict(tpl(), { ...clean, falsePositives: 1 }).pass).toBe(false)
    expect(replayVerdict(tpl(), { ...clean, disagreements: { ...clean.disagreements, amount: 1 } }).pass).toBe(false)
    expect(replayVerdict(tpl({ failures: 1 }), clean).pass).toBe(false)
    expect(replayVerdict(tpl({ status: 'quarantined' }), clean).pass).toBe(false)
    expect(replayVerdict(tpl(), { ...clean, kindDiffers: 1 }).pass).toBe(false)
    expect(replayVerdict(tpl(), { ...clean, comparedExact: 2 }).pass).toBe(false)
    expect(replayVerdict(tpl({ age_days: 13 }), clean).pass).toBe(false)
  })
})

/** Local export only (templates plus messages); never committed. Prints the evidence per learned template. */
const EXPORT = process.env.SMS_REPLAY_EXPORT ?? path.resolve(__dirname, '../../../../.claude/sms-replay-raw.json')

describe.skipIf(!existsSync(EXPORT))('learned templates against the live export', () => {
  it('prints the evidence and verdict per template', () => {
    const data = JSON.parse(readFileSync(EXPORT, 'utf8')) as { templates: ReplayTemplate[]; rows: ReplayRow[] }
    const lines = data.templates
      .filter((t) => t.tier === 'template')
      .map((t) => {
        const ev = replayTemplate(t, data.rows)
        const v = replayVerdict(t, ev)
        const d = ev.disagreements
        return `${t.id.slice(0, 8)} ${t.status} users=${t.users} matches=${t.match_count} age=${t.age_days}d | replay matched=${ev.matched} heldOut=${ev.heldOutUsers} independent=${ev.independent} exact=${ev.comparedExact} fp=${ev.falsePositives} dis(a/d/c/t)=${d.amount}/${d.direction}/${d.currency}/${d.digits} kindDiff=${ev.kindDiffers} | ${v.pass ? 'PASS' : `no: ${v.reason}`}`
      })
    console.log(lines.join('\n'))
    expect(lines.length).toBeGreaterThan(0)
  })
})
