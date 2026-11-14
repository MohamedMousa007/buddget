import { describe, expect, it } from 'vitest'
import { counterpartyHash, decideOwnTransfer, ownTransferSignals, type PairFacts } from './ownTransferDecision'

const facts = (over: Partial<PairFacts> = {}): PairFacts => ({
  differentAccounts: true, sameAccount: false, sameDevice: true, amountsEqual: true, withinFee: true, sameReference: false,
  sameCounterpartyHash: false, counterpartyIsOwnAccount: false, counterpartyIsProfileName: false, answered: null, ...over,
})

describe('decideOwnTransfer', () => {
  it('the pair on one device is never enough alone: it asks', () => {
    expect(decideOwnTransfer(facts())).toEqual({ verdict: 'ask', signals: ['device'] })
  })

  it.each([
    ['the same reference', { sameReference: true }],
    ['the same counterparty name', { sameCounterpartyHash: true }],
    ['counterparty digits of an own account', { counterpartyIsOwnAccount: true }],
    ['an earlier yes for these two accounts', { answered: true }],
  ])('settles with the device pair plus %s', (_name, over) => {
    expect(decideOwnTransfer(facts(over)).verdict).toBe('settle')
  })

  it.each([
    ['a reference but no shared device', { sameDevice: false, sameReference: true }],
    ['the same name but no shared device', { sameDevice: false, sameCounterpartyHash: true }],
    ['own-account digits but no pair on one device', { sameDevice: false, counterpartyIsOwnAccount: true }],
    ['only the profile name, even with the device pair', { counterpartyIsProfileName: true }],
    ['a fee difference with no reference', { amountsEqual: false, sameCounterpartyHash: true }],
  ])('only asks with %s', (_name, over) => {
    expect(decideOwnTransfer(facts(over)).verdict).toBe('ask')
  })

  it('allows a fee difference only when the reference matches', () => {
    expect(ownTransferSignals(facts({ amountsEqual: false, sameReference: true }))).toContain('device')
    expect(ownTransferSignals(facts({ amountsEqual: false }))).not.toContain('device')
    expect(ownTransferSignals(facts({ amountsEqual: false, withinFee: false, sameReference: true }))).not.toContain('device')
  })

  it('does nothing with no signal at all', () => {
    expect(decideOwnTransfer(facts({ sameDevice: false }))).toEqual({ verdict: 'none', signals: [] })
  })

  it('never calls the same account on both legs an own transfer, whatever else agrees', () => {
    expect(decideOwnTransfer(facts({ sameAccount: true, differentAccounts: false, sameReference: true, sameCounterpartyHash: true }))).toEqual({ verdict: 'none', signals: [] })
  })

  it('respects an earlier no', () => {
    expect(decideOwnTransfer(facts({ answered: false, sameReference: true }))).toEqual({ verdict: 'none', signals: [] })
  })
})

describe('counterpartyHash', () => {
  // Synthetic names only.
  it('is the same for one name however it is cased or spaced, for one user', () => {
    expect(counterpartyHash('u1', 'SAMPLE  PERSON')).toBe(counterpartyHash('u1', 'Sample Person'))
  })

  it('differs per user, so hashes can never be joined across users', () => {
    expect(counterpartyHash('u1', 'Sample Person')).not.toBe(counterpartyHash('u2', 'Sample Person'))
  })

  it('is not the name, and a one-part name is not hashed at all', () => {
    expect(counterpartyHash('u1', 'Sample Person')).toMatch(/^[0-9a-f]{32}$/)
    expect(counterpartyHash('u1', 'Sample')).toBeNull()
    expect(counterpartyHash('u1', null)).toBeNull()
  })
})
