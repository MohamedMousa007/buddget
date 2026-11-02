import { describe, expect, it } from 'vitest'
import { answersTo, withAlias, digitsOf, extractAccountTail, isSavableTail, matchByTail, tailsMatch } from './accountRef'

const m = (id: string, last4: string | null) => ({ id, last4 })

describe('tailsMatch', () => {
  it('matches a short tail against a longer saved one, leading zeros kept', () => {
    expect(tailsMatch('001', '0001')).toBe(true)
    expect(tailsMatch('0001', '001')).toBe(true)
    expect(tailsMatch('01', '0001')).toBe(true)
    expect(tailsMatch('00001', '0001')).toBe(true)
  })
  it('does not treat different digits or a single digit as a match', () => {
    expect(tailsMatch('301', '0001')).toBe(false)
    expect(tailsMatch('1', '0001')).toBe(false)
    expect(tailsMatch('1000', '0001')).toBe(false)
    expect(tailsMatch(null, '0001')).toBe(false)
    expect(tailsMatch('', '')).toBe(false)
  })
  it('reads Arabic-Indic digits', () => {
    expect(digitsOf('٠٠٠١')).toBe('0001')
    expect(tailsMatch('٠٠١', '0001')).toBe(true)
  })
})

describe('matchByTail', () => {
  const hsbc = [m('acct', '0001'), m('usd', '0110'), m('card', '5950'), m('none', null)]
  it('finds the one account a short tail names', () => {
    expect(matchByTail(hsbc, '001')).toEqual({ id: 'acct', ambiguous: false })
    expect(matchByTail(hsbc, '110')).toEqual({ id: 'usd', ambiguous: false })
    expect(matchByTail(hsbc, '5950')).toEqual({ id: 'card', ambiguous: false })
  })
  it('prefers an exact tail over a partial one', () => {
    expect(matchByTail([m('a', '0001'), m('b', '001')], '001')).toEqual({ id: 'b', ambiguous: false })
  })
  it('never picks between two accounts that both fit', () => {
    expect(matchByTail([m('a', '0001'), m('b', '1001')], '001')).toEqual({ id: null, ambiguous: true })
    expect(matchByTail([m('a', '1234'), m('b', '1234')], '1234')).toEqual({ id: null, ambiguous: true })
  })
  it('attributes money on a two-digit tail only when the saved number is exactly that', () => {
    expect(matchByTail([m('a', '07')], '07')).toEqual({ id: 'a', ambiguous: false })
    expect(matchByTail([m('a', '5507')], '07')).toEqual({ id: null, ambiguous: false })
  })
  it('returns nothing for no tail, a one-digit tail or no fit', () => {
    expect(matchByTail(hsbc, null)).toEqual({ id: null, ambiguous: false })
    expect(matchByTail(hsbc, '1')).toEqual({ id: null, ambiguous: false })
    expect(matchByTail(hsbc, '9999')).toEqual({ id: null, ambiguous: false })
  })
})

describe('extractAccountTail', () => {
  it.each([
    ['27OCT26 EL UP Purchase from 103-104***-001 EGP 925.00- Your available balance is EGP 598.99', '001'],
    ['31OCT26 CT99 ATM Cash Withdrawal from 103-104***-001 EGP 1,000.00- Your available balance is EGP 3,270.17', '001'],
    ['Your HSBC Account ********0001 was debited with IPN outward transfer', '0001'],
    ['Card ending in 1234 was used', '1234'],
    ['Debit card no. XXXX5950 declined', '5950'],
    ['A/C: **207 debited EGP 50', '207'],
  ])('reads %s', (body, tail) => {
    expect(extractAccountTail(body)).toBe(tail)
  })
  it('ignores numbers that are not masked account references', () => {
    expect(extractAccountTail('Purchase EGP 925.00 at SHOP, balance EGP 598.99')).toBeNull()
    expect(extractAccountTail('Transfer to 103-104***-001 EGP 9,968.00+')).toBeNull()
    expect(extractAccountTail('Your code is 123456')).toBeNull()
  })
})

describe('isSavableTail', () => {
  it('accepts no number or 2 to 6 digits and nothing else', () => {
    for (const ok of ['', '01', '001', '0001', '00001', '000001']) expect(isSavableTail(ok)).toBe(true)
    for (const bad of ['1', '0000001']) expect(isSavableTail(bad)).toBe(false)
  })
})

describe('aliases', () => {
  const acct = { id: 'acct', last4: '0001', last4Aliases: ['5950'] }
  const other = { id: 'other', last4: '2000', last4Aliases: [] as string[] }
  it('an account answers to its displayed number and each alias', () => {
    expect(answersTo(acct, '0001')).toBe(true)
    expect(answersTo(acct, '001')).toBe(true)
    expect(answersTo(acct, '5950')).toBe(true)
    expect(answersTo(acct, '2000')).toBe(false)
  })
  it('matching finds the account by an alias, and one account holding a tail twice is not ambiguous', () => {
    expect(matchByTail([acct, other], '5950')).toEqual({ id: 'acct', ambiguous: false })
    expect(matchByTail([{ id: 'a', last4: '0001', last4Aliases: ['001'] }], '001')).toEqual({ id: 'a', ambiguous: false })
  })
  it('two accounts sharing an alias are ambiguous', () => {
    expect(matchByTail([acct, { id: 'b', last4: '9999', last4Aliases: ['5950'] }], '5950')).toEqual({ id: null, ambiguous: true })
  })
})

describe('withAlias (linking a detected number to an existing account)', () => {
  it('sets the number when the account has none', () => {
    expect(withAlias({ last4: null, last4Aliases: [] }, '5950')).toEqual({ last4: '5950' })
  })
  it('keeps the number that already matches and adds the new one as an alias', () => {
    expect(withAlias({ last4: '0001', last4Aliases: [] }, '5950')).toEqual({ last4Aliases: ['5950'] })
  })
  it('changes nothing for a number the account already answers to, including a shorter print of it', () => {
    expect(withAlias({ last4: '0001' }, '001')).toEqual({})
    expect(withAlias({ last4: '0001', last4Aliases: ['5950'] }, '5950')).toEqual({})
  })
  it('ignores a number too short to mean anything, and caps the list', () => {
    expect(withAlias({ last4: '0001' }, '7')).toEqual({})
    const many = Array.from({ length: 8 }, (_, i) => `10${i}0`)
    expect(withAlias({ last4: '0001', last4Aliases: many }, '9999').last4Aliases).toHaveLength(8)
  })
})
