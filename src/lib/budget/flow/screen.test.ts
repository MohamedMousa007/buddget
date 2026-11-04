import { describe, expect, it } from 'vitest'
import { answer, createFlow, nextQuestion, pruneInapplicable, screenNodes, skip } from './flow'
import { NODE_BY_ID } from './nodes'

describe('screens', () => {
  it('reveals a follow-up only once its parent has a value', () => {
    let s = createFlow('save', {})
    s = answer(s, 'income', 12000)
    s = answer(s, 'incomeType', 'salary')
    s = answer(s, 'incomeStability', 'fixed')
    s = answer(s, 'payFrequency', 'monthly')
    s = answer(s, 'payday', 25)
    const head = nextQuestion(s)!
    expect(head.id).toBe('housing')
    expect(screenNodes(s, head, {}, []).map((x) => x.id)).toEqual(['housing'])
    expect(screenNodes(s, head, { housing: 'own' }, []).map((x) => x.id)).toEqual(['housing', 'ownType'])
    expect(screenNodes(s, head, { housing: 'rent' }, []).map((x) => x.id)).toEqual(['housing'])
  })
  it('puts a rent amount, how often, and utilities on one card', () => {
    let s = createFlow('save', {})
    s = answer(s, 'housing', 'rent')
    const head = NODE_BY_ID.get('rent')!
    expect(screenNodes(s, head, { rent: 5000, rentFreq: 'monthly' }, []).map((x) => x.id)).toEqual(['rent', 'rentFreq', 'rentIncludesUtilities'])
  })
  it('lets a skipped amount unlock the fields after it', () => {
    let s = createFlow('save', {})
    s = answer(s, 'housing', 'rent')
    const head = NODE_BY_ID.get('rent')!
    expect(screenNodes(s, head, {}, ['rent']).map((x) => x.id)).toEqual(['rent'])
  })
  it('rebuilds a card from its own answers when reopened', () => {
    let s = createFlow('save', {})
    s = answer(s, 'housing', 'own')
    s = answer(s, 'ownType', 'mortgage')
    s = answer(s, 'mortgagePayment', 7000)
    const ids = screenNodes(s, NODE_BY_ID.get('housing')!, { housing: 'own', ownType: 'mortgage' }, [], true).map((x) => x.id)
    expect(ids).toEqual(['housing', 'ownType'])
    expect(skip(s, 'x').skipped).toEqual(['x'])
  })
  it('drops the answers that stop applying when an earlier answer changes', () => {
    let s = createFlow('save', {})
    s = answer(s, 'housing', 'own')
    s = answer(s, 'ownType', 'mortgage')
    s = answer(s, 'mortgagePayment', 7000)
    s = answer(s, 'propertyCosts', 500)
    s = answer(s, 'housing', 'rent')
    const after = pruneInapplicable(s)
    expect(Object.keys(after.a).sort()).toEqual(['housing'])
  })
  it('keeps confirmations and everything that still applies', () => {
    let s = createFlow('save', {})
    s = answer(s, 'housing', 'rent')
    s = answer(s, 'rent', 4000)
    expect(pruneInapplicable(s).a).toEqual({ housing: 'rent', rent: 4000 })
  })
})
