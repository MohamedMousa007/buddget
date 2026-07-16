import { describe, expect, it } from 'vitest'
import { normalizeMerchant } from './merchantNormalizer'

describe('normalizeMerchant — brand names', () => {
  it.each([
    ['Netflix.com', 'Netflix'],
    ['NETFLIX.COM 866-579-7172', 'Netflix'],
    ['Spotify AB', 'Spotify'],
    ['OPENAI *CHATGPT', 'ChatGPT Plus'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeMerchant(raw, 'purchase')).toBe(expected)
  })

  it('resolves brands for online purchases too', () => {
    expect(normalizeMerchant('Netflix.com', 'online_purchase')).toBe('Netflix')
  })
})

describe('normalizeMerchant — cosmetic tidy for ordinary merchants', () => {
  it.each([
    ['LA ROSE PASTRY', 'La Rose Pastry'],
    ['CARREFOUR EGYPT SHERATON', 'Carrefour Egypt Sheraton'],
    ['UBER* TRIP', 'Uber Trip'],
    ['POS  SPINNEYS MAADI', 'Spinneys Maadi'],
    ['  TALABAT   EG  ', 'Talabat Eg'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeMerchant(raw, 'purchase')).toBe(expected)
  })

  it('leaves a name the bank already cased alone', () => {
    // Title-casing this would produce "El Wahat For Oil" — different from what the user
    // sees on their statement, for no gain.
    expect(normalizeMerchant('EL Wahat for oil', 'purchase')).toBe('EL Wahat for oil')
  })

  it('leaves Arabic untouched', () => {
    expect(normalizeMerchant('كارفور مصر', 'purchase')).toBe('كارفور مصر')
  })
})

describe('normalizeMerchant — never brand-resolves a composed phrase', () => {
  // buildCleanTitle composes these; brand-resolving them would rename a person's transfer
  // after a streaming service.
  it.each([
    ['Transfer to Ahmed', 'own_transfer'],
    ['ATM Withdrawal — CIB', 'atm_withdrawal'],
    ['Credit Card Payment — CIB', 'cc_payoff'],
    ['Currency Exchange — HSBC', 'currency_exchange'],
    ['Refund — Netflix.com', 'refund'],
  ] as const)('%s (%s) is left as-is', (raw, kind) => {
    expect(normalizeMerchant(raw, kind)).toBe(raw)
  })

  it('does not brand-resolve a transfer to a person whose name contains a brand token', () => {
    expect(normalizeMerchant('Transfer to Osama', 'instant_transfer_out')).toBe('Transfer to Osama')
  })
})

describe('normalizeMerchant — degenerate input', () => {
  it.each([null, undefined, '', '   '])('returns null for %p', (raw) => {
    expect(normalizeMerchant(raw, 'purchase')).toBeNull()
  })

  it('never returns empty — a raw name beats no name', () => {
    // Tidy would strip this to nothing; the original must survive.
    expect(normalizeMerchant('***', 'purchase')).toBe('***')
  })
})
