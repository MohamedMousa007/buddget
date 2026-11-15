import { describe, expect, it } from 'vitest'
import { blocksFeature, spendLevel, ESSENTIAL_CAP_MULTIPLE } from './spendGuard'

describe('spend guard', () => {
  it('has no effect without a cap', () => {
    expect(spendLevel({ costMicro: 9e9, capUsd: null })).toBe('ok')
    expect(spendLevel({ costMicro: 9e9, capUsd: 0 })).toBe('ok')
  })
  it('warns at 80% and caps at 100%', () => {
    expect(spendLevel({ costMicro: 7.9e6, capUsd: 10 })).toBe('ok')
    expect(spendLevel({ costMicro: 8e6, capUsd: 10 })).toBe('warn')
    expect(spendLevel({ costMicro: 10e6, capUsd: 10 })).toBe('capped')
  })
  it('keeps bank-text and receipt capture on past the cap, up to their own higher ceiling', () => {
    const at = (mult: number) => ({ costMicro: 10e6 * mult, capUsd: 10 })
    expect(blocksFeature(at(1), 'chat')).toBe(true)
    expect(blocksFeature(at(1), 'sms')).toBe(false)
    expect(blocksFeature(at(1), 'receipt')).toBe(false)
    expect(blocksFeature({ costMicro: 8e6, capUsd: 10 }, 'chat')).toBe(false)
    expect(blocksFeature(at(ESSENTIAL_CAP_MULTIPLE - 0.01), 'sms')).toBe(false)
    expect(blocksFeature(at(ESSENTIAL_CAP_MULTIPLE), 'sms')).toBe(true)
    expect(blocksFeature(at(ESSENTIAL_CAP_MULTIPLE), 'receipt')).toBe(true)
  })
  it('never blocks any feature without a cap', () => {
    expect(blocksFeature({ costMicro: 9e9, capUsd: null }, 'sms')).toBe(false)
  })
})
