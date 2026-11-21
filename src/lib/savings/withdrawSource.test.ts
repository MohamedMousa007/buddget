import { describe, expect, it } from 'vitest'
import { defaultWithdrawSource } from './withdrawSource'

const p = (id: string, currentBalance: number) => ({ account: { id, currentBalance } })

describe('defaultWithdrawSource', () => {
  it('skips an empty pocket when another one has money', () => {
    expect(defaultWithdrawSource([p('vault', 0), p('qnb', 500)])).toBe('qnb')
  })
  it('keeps the first pocket when it has money', () => {
    expect(defaultWithdrawSource([p('a', 10), p('b', 500)])).toBe('a')
  })
  it('falls back to the first pocket when all are empty, and to none without pockets', () => {
    expect(defaultWithdrawSource([p('a', 0), p('b', 0)])).toBe('a')
    expect(defaultWithdrawSource([])).toBeNull()
  })
  it('the pocket the sheet was opened from wins, even when empty', () => {
    expect(defaultWithdrawSource([p('vault', 0), p('qnb', 500)], 'vault')).toBe('vault')
  })
})
