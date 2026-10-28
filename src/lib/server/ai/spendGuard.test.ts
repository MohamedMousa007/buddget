import { describe, expect, it } from 'vitest'
import { blocksFeature, spendLevel } from './spendGuard'

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
  it('keeps bank-text and receipt capture on when capped', () => {
    expect(blocksFeature('capped', 'chat')).toBe(true)
    expect(blocksFeature('capped', 'sms')).toBe(false)
    expect(blocksFeature('capped', 'receipt')).toBe(false)
    expect(blocksFeature('warn', 'chat')).toBe(false)
  })
})
