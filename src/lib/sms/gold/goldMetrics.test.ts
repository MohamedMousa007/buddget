import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import labelsJson from './goldSet.json'
import { computeGoldMetrics, formatMetrics, providerStageMetrics, type GoldInputs, type GoldLabel } from './goldMetrics'

const labels = labelsJson as Record<string, GoldLabel>
/** Local export of scripts/qa/sms-gold-inputs.sql. Never committed: without it only the fixture checks run. */
const INPUTS = process.env.SMS_GOLD_INPUTS ?? path.resolve(__dirname, '../../../../.claude/sms-gold-inputs.json')
/** Optional: masked bodies by log id (`select id, masked_body from sms_parse_log`), for the checks that need wording. */
const BODIES = process.env.SMS_GOLD_BODIES ?? path.resolve(__dirname, '../../../../.claude/sms-gold-bodies.json')
/** Optional: the template replay export, whose recent rows still carry raw text. */
const RAW = process.env.SMS_REPLAY_EXPORT ?? path.resolve(__dirname, '../../../../.claude/sms-replay-raw.json')

describe('gold set fixture', () => {
  it('holds labels only, keyed by log id', () => {
    const allowed = new Set(['s', 'topup', 'relay', 'fx'])
    for (const [id, label] of Object.entries(labels)) {
      expect(id).toMatch(/^[0-9a-f-]{36}$/)
      for (const [k, v] of Object.entries(label)) {
        expect(allowed.has(k)).toBe(true)
        // A value is a split flag, a leg direction or another log id: never text from a message.
        expect(String(v)).toMatch(/^(t|h|x|debit|credit|unknown|[0-9a-f-]{36})$/)
      }
    }
  })

  it('keeps about 30% as holdout', () => {
    const all = Object.values(labels)
    const share = all.filter((l) => l.s === 'h').length / all.length
    expect(share).toBeGreaterThan(0.25)
    expect(share).toBeLessThan(0.35)
  })
})

describe.skipIf(!existsSync(INPUTS))('gold set metrics (needs the local inputs export)', () => {
  it('prints the section 5 metrics for train and holdout', () => {
    const inputs = JSON.parse(readFileSync(INPUTS, 'utf8')) as GoldInputs
    if (existsSync(BODIES)) inputs.bodies = JSON.parse(readFileSync(BODIES, 'utf8'))
    if (existsSync(RAW)) inputs.raw = Object.fromEntries((JSON.parse(readFileSync(RAW, 'utf8')) as { rows: { id: string; raw: string | null }[] }).rows.filter((r) => r.raw).map((r) => [r.id, r.raw as string]))
    for (const [split, title] of [['t', 'train'], ['h', 'holdout']] as const) {
      const metrics = [...computeGoldMetrics(inputs, labels, split), ...providerStageMetrics(inputs, labels, split)]
      console.log(formatMetrics(title, metrics))
      expect(metrics.length).toBeGreaterThan(0)
    }
    // A replay of every stored message; slower than a unit test, more so under coverage.
  }, 120_000)
})
