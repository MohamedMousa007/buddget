import { describe, expect, it } from 'vitest'
import { selectedPocket } from './selectedPocket'

const p = (id: string) => ({ account: { id } }) as never

describe('selectedPocket (Add money)', () => {
  it('keeps the pocket the user picked', () => {
    expect(selectedPocket([p('a'), p('b')], 'b', null)?.account.id).toBe('b')
  })
  it('the sheet opened before the first pocket existed: the pocket that appears is selected (new account, Savings from +)', () => {
    expect(selectedPocket([], null, null)).toBeUndefined()
    expect(selectedPocket([p('vault')], null, null)?.account.id).toBe('vault')
  })
  it('a pick that no longer exists falls back to the preselected, then the first pocket', () => {
    expect(selectedPocket([p('a'), p('b')], 'gone', 'b')?.account.id).toBe('b')
    expect(selectedPocket([p('a')], 'gone', null)?.account.id).toBe('a')
  })
})
