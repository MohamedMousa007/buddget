import { describe, it, expect } from 'vitest'
import { savingsPace } from './savingsPace'

describe('savingsPace', () => {
  it('nothing saved this month', () => {
    expect(savingsPace(0, 5000).state).toBe('none')
  })
  it('ahead at +8% or more', () => {
    expect(savingsPace(5400, 5000)).toEqual({ state: 'ahead', percent: 8 })
  })
  it('behind at −8% or less', () => {
    expect(savingsPace(4600, 5000)).toEqual({ state: 'behind', percent: -8 })
  })
  it('on pace in between', () => {
    expect(savingsPace(5100, 5000).state).toBe('onpace')
  })
  it('first-ever saving reads ahead', () => {
    expect(savingsPace(1000, 0)).toEqual({ state: 'ahead', percent: 100 })
  })
})
