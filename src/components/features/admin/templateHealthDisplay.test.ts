import { describe, it, expect } from 'vitest'
import {
  tierChip,
  statusChip,
  failureRate,
  matchesFilter,
  type TemplateFilter,
} from './templateHealthDisplay'

const row = (tier: string, status: string, match = 0, fail = 0) =>
  ({ tier, status, match_count: match, failure_count: fail }) as never

describe('tier + status chips', () => {
  it('labels both reaches', () => {
    expect(tierChip('curated_db').label).toBe('Curated DB')
    expect(tierChip('template').label).toBe('Template')
  })

  it('labels every health state', () => {
    expect(statusChip('active').label).toBe('Active')
    expect(statusChip('quarantined').label).toBe('Quarantined')
    expect(statusChip('retired').label).toBe('Retired')
    expect(statusChip('exported').label).toBe('In code')
  })

  it('explains quarantine, which is the least obvious state', () => {
    expect(statusChip('quarantined').title).toMatch(/shadow mode/i)
  })

  it('shows an unrecognised value rather than blanking the cell', () => {
    // A future tier/status must stay debuggable in the panel instead of rendering empty.
    expect(tierChip('something_new').label).toBe('something_new')
    expect(statusChip('something_new').label).toBe('something_new')
    expect(tierChip('').label).toBe('—')
  })
})

describe('failureRate — a share, never a raw count', () => {
  it('expresses failures relative to matches served', () => {
    expect(failureRate(row('template', 'active', 1000, 3))).toBeCloseTo(0.003)
    expect(failureRate(row('template', 'active', 5, 3))).toBeCloseTo(0.6)
  })

  it('distinguishes high and low volume templates with the same failure count', () => {
    // The whole reason it is a rate: these two must not look alike.
    const busy = failureRate(row('template', 'active', 1000, 3))!
    const fragile = failureRate(row('template', 'active', 5, 3))!
    expect(fragile).toBeGreaterThan(busy * 100)
  })

  it('returns null rather than 0 when nothing has been served', () => {
    // A rate over zero matches is meaningless, not "perfect".
    expect(failureRate(row('template', 'active', 0, 0))).toBeNull()
    expect(failureRate(row('template', 'active', 0, 2))).toBeNull()
  })
})

describe('filters', () => {
  const rows = [
    row('curated_db', 'active'),
    row('template', 'active'),
    row('template', 'quarantined'),
    row('curated_db', 'retired'),
  ]
  const count = (f: TemplateFilter) => rows.filter((r) => matchesFilter(r, f)).length

  it('all shows everything', () => expect(count('all')).toBe(4))
  it('tier filters split by reach', () => {
    expect(count('curated_db')).toBe(2)
    expect(count('template')).toBe(2)
  })
  it('needs-attention catches anything not actively parsing, at either reach', () => {
    // The quarantined Template and the retired Curated DB row — both need a human.
    expect(count('unhealthy')).toBe(2)
  })
})
