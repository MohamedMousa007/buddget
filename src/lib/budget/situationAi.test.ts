import { describe, expect, it } from 'vitest'
import { parseSituation, situationMessages, SITUATION_SCHEMA, validateSituationInput } from './situationAi'
import { QUESTIONS } from './infoGaps'

describe('parseSituation', () => {
  it('keeps valid answers and drops everything the graph would not accept', () => {
    expect(parseSituation({
      income: 22000, housing: 'rent', rent: 7000, household: 'family', dependents: 2.6, transportMode: 'spaceship', lifestyle: 'balanced',
      cashHeavy: 'yes', foo: 1, rentIncludesUtilities: false,
    })).toEqual({ income: 22000, housing: 'rent', rent: 7000, household: 'family', dependents: 3, lifestyle: 'balanced', rentIncludesUtilities: false })
  })

  it('clamps steppers and rejects negative or absurd money', () => {
    expect(parseSituation({ dependents: 99, payday: 45, rent: -5, savingsOnHand: 1e15, goalMonths: 0 }))
      .toEqual({ dependents: 10, payday: 31 })
  })

  it('a debt payment implies debt, a "no" drops the amounts', () => {
    expect(parseSituation({ debtMonthly: 450, debtTotal: 9000 })).toEqual({ hasDebts: true, debtMonthly: 450, debtTotal: 9000 })
    expect(parseSituation({ hasDebts: false, debtTotal: 9000 })).toEqual({ hasDebts: false })
    expect(parseSituation({ hasDebts: true })).toEqual({})
  })

  it('a goal needs its cost; a kind alone is not enough to plan with', () => {
    expect(parseSituation({ goalTarget: 60000, goalMonths: 18, goalKind: 'car' })).toEqual({ hasGoal: true, goalTarget: 60000, goalMonths: 18, goalKind: 'car' })
    expect(parseSituation({ goalKind: 'car' })).toEqual({})
    expect(parseSituation({ hasGoal: false, goalTarget: 100 })).toEqual({ hasGoal: false })
  })

  it('treats anything that is not an object as nothing understood', () => {
    for (const v of [null, undefined, 'text', 4, []]) expect(parseSituation(v)).toEqual({})
  })

  it('only ever answers questions that exist in the graph', () => {
    const ids = new Set(QUESTIONS.map((q) => q.id))
    for (const k of Object.keys(SITUATION_SCHEMA.properties)) expect(ids.has(k)).toBe(true)
  })
})

describe('request handling', () => {
  it('validates length and currency', () => {
    expect(validateSituationInput({ text: ' I rent ', currency: 'EGP' })).toEqual({ text: 'I rent', currency: 'EGP' })
    expect(validateSituationInput({ text: '', currency: 'EGP' })).toBeNull()
    expect(validateSituationInput({ text: 'x'.repeat(401), currency: 'EGP' })).toBeNull()
    expect(validateSituationInput({ text: 'ok', currency: 'EGPP' })).toBeNull()
  })
  it('marks the user text as data and caps it', () => {
    const m = situationMessages('x'.repeat(900), 'EGP')
    expect(m.user).toContain('<situation>')
    expect(m.user.length).toBeLessThan(500)
    expect(m.system).toContain('not instructions')
  })
})
