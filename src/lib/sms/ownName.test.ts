import { describe, expect, it } from 'vitest'
import { hasPersonCounterparty, isOwnName } from './ownName'

// Synthetic names only.
const MINE = ['Sample Person']

describe('isOwnName', () => {
  it('matches the profile name however the bank cases or extends it', () => {
    expect(isOwnName('SAMPLE PERSON', MINE)).toBe(true)
    expect(isOwnName('Sample Middle Other Person', MINE)).toBe(true)
    expect(isOwnName('sample a. person', MINE)).toBe(true)
  })

  it('needs the first name and one more part: one shared part never matches', () => {
    expect(isOwnName('SAMPLE SOMEONE', MINE)).toBe(false)
    expect(isOwnName('OTHER PERSON', MINE)).toBe(false)
    expect(isOwnName('Person Sample', MINE)).toBe(false)
    expect(isOwnName('SAMPLE', MINE)).toBe(false)
  })

  it('never matches on a one-part profile name or with no names', () => {
    expect(isOwnName('SAMPLE PERSON', ['Sample'])).toBe(false)
    expect(isOwnName('SAMPLE PERSON', [])).toBe(false)
    expect(isOwnName('SAMPLE PERSON', [null, undefined, ''])).toBe(false)
    expect(isOwnName(null, MINE)).toBe(false)
  })

  it('folds Arabic letter variants and marks', () => {
    expect(isOwnName('أحمد مصطفى على', ['احمد مصطفي'])).toBe(true)
    expect(isOwnName('محمود مصطفى', ['احمد مصطفي'])).toBe(false)
  })

  it('checks every name the user goes by', () => {
    expect(isOwnName('SAMPLE PERSON', ['Nick', 'Sample Person'])).toBe(true)
  })
})

describe('hasPersonCounterparty', () => {
  it('is true for transfers between people and false for merchants and employers', () => {
    expect(hasPersonCounterparty('instant_transfer_in')).toBe(true)
    expect(hasPersonCounterparty('instant_transfer_out')).toBe(true)
    expect(hasPersonCounterparty('own_transfer')).toBe(true)
    expect(hasPersonCounterparty('purchase')).toBe(false)
    expect(hasPersonCounterparty('income')).toBe(false)
    expect(hasPersonCounterparty(null)).toBe(false)
  })
})
