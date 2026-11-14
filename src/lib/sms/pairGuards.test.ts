import { describe, expect, it } from 'vitest'
import { legDirectionOfKind, pairGuardsAllow, transferFeeTolerance, type PairLegFacts } from './pairing'

/**
 * I7 and I3 (S2c step 3): the pure mirror of the guards in migration 0271. A guard refuses only two known, conflicting
 * values; an unknown (null) on either side passes. Invented tails and amounts throughout.
 */

const out = (over: Partial<PairLegFacts> = {}): PairLegFacts => ({
  id: 'o', kind: 'instant_transfer_out', accountLast4: '1111', currency: 'EGP', amount: 500, ...over,
})
const inn = (over: Partial<PairLegFacts> = {}): PairLegFacts => ({
  id: 'i', kind: 'instant_transfer_in', accountLast4: '2222', currency: 'EGP', amount: 500, ...over,
})
const card = (over: Partial<PairLegFacts> = {}): PairLegFacts => ({
  id: 'c', kind: 'cc_payoff', accountLast4: '4444', currency: 'EGP', amount: 1000, ...over,
})
const funding = (over: Partial<PairLegFacts> = {}): PairLegFacts => ({
  id: 'f', kind: 'own_transfer', legDirection: 'debit', accountLast4: '1234', currency: 'EGP', amount: 1000, ...over,
})
const tol = transferFeeTolerance(1000)

describe('I7: unknown never refuses a pair', () => {
  it('a null currency on one side passes', () => {
    expect(pairGuardsAllow(out({ currency: null }), inn())).toBe(true)
    expect(pairGuardsAllow(out(), inn({ currency: null }))).toBe(true)
  })

  it('two known, different currencies refuse (case does not matter)', () => {
    expect(pairGuardsAllow(out({ currency: 'EGP' }), inn({ currency: 'USD' }))).toBe(false)
    expect(pairGuardsAllow(out({ currency: 'egp' }), inn({ currency: 'EGP' }))).toBe(true)
  })

  it('two transfers out refuse; out plus in pass; two transfers in refuse', () => {
    expect(pairGuardsAllow(out(), out({ id: 'o2', accountLast4: '3333' }))).toBe(false)
    expect(pairGuardsAllow(out(), inn())).toBe(true)
    expect(pairGuardsAllow(inn(), inn({ id: 'i2', accountLast4: '3333' }))).toBe(false)
  })

  it('an unknown direction on either side passes', () => {
    expect(pairGuardsAllow(out({ kind: 'own_transfer', legDirection: null }), out({ id: 'o2', kind: 'own_transfer', legDirection: null, accountLast4: '3333' }))).toBe(true)
    expect(pairGuardsAllow(out({ kind: 'own_transfer', legDirection: 'debit' }), out({ id: 'o2', kind: 'own_transfer', legDirection: null, accountLast4: '3333' }))).toBe(true)
  })

  it('a published direction counts when the kind is uncertain: two debits published as own transfers refuse', () => {
    const a = out({ kind: 'own_transfer', legDirection: 'debit' })
    const b = out({ id: 'o2', kind: 'own_transfer', legDirection: 'debit', accountLast4: '3333' })
    expect(pairGuardsAllow(a, b)).toBe(false)
  })

  it('the same known account on both legs refuses; a different or unknown account passes', () => {
    expect(pairGuardsAllow(out({ accountLast4: '1111' }), inn({ accountLast4: '1111' }))).toBe(false)
    expect(pairGuardsAllow(out({ accountLast4: '0001' }), inn({ accountLast4: '9001' }))).toBe(true)
    expect(pairGuardsAllow(out({ accountLast4: null }), inn({ accountLast4: '1111' }))).toBe(true)
  })

  it('a currency exchange legitimately has both legs on one account and is exempt from the account, currency and direction guards', () => {
    const fxOut = out({ kind: 'currency_exchange', accountLast4: '1111', currency: 'EGP' })
    const fxIn = inn({ kind: 'currency_exchange', accountLast4: '1111', currency: 'USD' })
    expect(pairGuardsAllow(fxOut, fxIn, { selfKind: 'currency_exchange' })).toBe(true)
  })
})

describe('I3: which candidate rows may be claimed', () => {
  it('a processing sibling passes', () => {
    expect(pairGuardsAllow(out(), inn({ status: 'processing' }))).toBe(true)
  })

  it('a failed, rejected, duplicate or held sibling refuses', () => {
    expect(pairGuardsAllow(out(), inn({ status: 'failed' }))).toBe(false)
    expect(pairGuardsAllow(out(), inn({ status: 'rejected' }))).toBe(false)
    expect(pairGuardsAllow(out(), inn({ isDuplicate: true }))).toBe(false)
    expect(pairGuardsAllow(out(), inn({ awaitingConfirmation: true }))).toBe(false)
  })

  it('a claim that names a sibling refuses every other', () => {
    expect(pairGuardsAllow(out(), inn(), { siblingId: 'i' })).toBe(true)
    expect(pairGuardsAllow(out(), inn(), { siblingId: 'someone-else' })).toBe(false)
  })

  it('the caller sends the direction it decided on, which beats what its row published', () => {
    const self = out({ kind: 'own_transfer', legDirection: null })
    expect(pairGuardsAllow(self, inn(), { selfDirection: 'credit' })).toBe(false)
    expect(pairGuardsAllow(self, inn(), { selfDirection: 'debit' })).toBe(true)
  })
})

describe('P0-2: a card repayment pairs only with a funding leg that could have paid it', () => {
  it('a transfer out that names another person is not a funding leg', () => {
    const toSomeoneElse = funding({ kind: 'instant_transfer_out', counterpartyHash: 'h-person', counterpartyIsSelf: false })
    expect(pairGuardsAllow(card(), toSomeoneElse)).toBe(false)
    expect(pairGuardsAllow(toSomeoneElse, card())).toBe(false)
  })

  it('a transfer to the user\'s own name is allowed', () => {
    expect(pairGuardsAllow(card(), funding({ counterpartyHash: 'h-me', counterpartyIsSelf: true }))).toBe(true)
  })

  it('a transfer that names other digits than the card is not a funding leg, in both claim orders', () => {
    const otherDigits = funding({ kind: 'instant_transfer_out', counterpartyLast4: '9999' })
    expect(pairGuardsAllow(card(), otherDigits)).toBe(false)
    expect(pairGuardsAllow(otherDigits, card())).toBe(false)
  })

  it('a funding leg that names the card\'s digits, even printed shorter, is allowed', () => {
    expect(pairGuardsAllow(card(), funding({ counterpartyLast4: '4444' }))).toBe(true)
    expect(pairGuardsAllow(card({ accountLast4: '0444' }), funding({ counterpartyLast4: '444' }))).toBe(true)
  })

  it('a funding leg with no destination digits and the exact amount is claimed (the shape of the two live true pairs)', () => {
    expect(pairGuardsAllow(card(), funding({ counterpartyLast4: null, counterpartyHash: null }))).toBe(true)
  })

  it('a fee difference pairs only with matching digits or the same payment reference', () => {
    const withFee = funding({ amount: 1012 })
    expect(pairGuardsAllow(card(), withFee, { amountTolerance: tol })).toBe(false)
    expect(pairGuardsAllow(card(), funding({ amount: 1012, counterpartyLast4: '4444' }), { amountTolerance: tol })).toBe(true)
    expect(pairGuardsAllow(card({ referenceHash: 'r1' }), funding({ amount: 1012, referenceHash: 'r1' }), { amountTolerance: tol })).toBe(true)
    expect(pairGuardsAllow(card({ referenceHash: 'r1' }), funding({ amount: 1012, referenceHash: 'r2' }), { amountTolerance: tol })).toBe(false)
  })

  it('a fee difference beyond the allowance refuses even with matching digits', () => {
    expect(pairGuardsAllow(card(), funding({ amount: 1400, counterpartyLast4: '4444' }), { amountTolerance: tol })).toBe(false)
  })

  it('digits shorter than 3 cannot be compared, so they are unknown and do not refuse', () => {
    expect(pairGuardsAllow(card(), funding({ counterpartyLast4: '12' }))).toBe(true)
  })
})

describe('legDirectionOfKind: the direction a leg arrived with', () => {
  it('names credits, debits, and leaves everything else unknown', () => {
    expect(legDirectionOfKind('instant_transfer_in')).toBe('credit')
    expect(legDirectionOfKind('income')).toBe('credit')
    expect(legDirectionOfKind('cc_payoff')).toBe('credit')
    expect(legDirectionOfKind('instant_transfer_out')).toBe('debit')
    expect(legDirectionOfKind('purchase')).toBe('debit')
    expect(legDirectionOfKind('online_purchase')).toBe('debit')
    expect(legDirectionOfKind('own_transfer')).toBeNull()
    expect(legDirectionOfKind(null)).toBeNull()
  })
})
