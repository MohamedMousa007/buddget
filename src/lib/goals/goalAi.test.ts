import { describe, it, expect } from 'vitest'
import { parseCostReply, parseGoalReply } from './goalAi'
import { projectedFinish } from './goalPlan'

const now = new Date(2026, 9, 18)

describe('parseGoalReply', () => {
  it('reads a wrapped reply and normalises', () => {
    const g = parseGoalReply('Sure: {"category":"vacation","name":"Dahab week","target":38000.4,"date":"2027-08"}', now)
    expect(g).toEqual({ category: 'vacation', name: 'Dahab week', target: 38000, date: '2027-08-01' })
  })
  it('drops past dates and bad numbers, falls back to custom', () => {
    const g = parseGoalReply('{"category":"nonsense","name":"x","target":-5,"date":"2020-01"}', now)
    expect(g).toEqual({ category: 'custom', name: 'x', target: undefined, date: undefined })
  })
  it('throws when unreadable', () => {
    expect(() => parseGoalReply('no json', now)).toThrow()
    expect(() => parseGoalReply('{"name":""}', now)).toThrow()
  })
})

describe('parseCostReply', () => {
  it('keeps up to three valid options', () => {
    const c = parseCostReply('{"options":[{"label":"Camp","amount":30000},{"label":"","amount":1},{"label":"Hotel","amount":"38000"},{"label":"Resort","amount":45000},{"label":"X","amount":9}],"assumption":"Two people"}')
    expect(c.options.map((o) => o.amount)).toEqual([30000, 38000, 45000])
    expect(c.assumption).toBe('Two people')
  })
  it('throws without options', () => {
    expect(() => parseCostReply('{"options":[]}')).toThrow()
  })
})

describe('projectedFinish', () => {
  it('rounds up to whole periods', () => {
    expect(projectedFinish(10000, 3000, 'monthly', now)).toBe('2027-02-01')
    expect(projectedFinish(10000, 3000, 'quarterly', now)).toBe('2027-10-01')
    expect(projectedFinish(10000, 0, 'monthly', now)).toBeNull()
  })
})
