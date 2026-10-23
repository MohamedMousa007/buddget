import { describe, expect, it } from 'vitest'
import { prioritiesFor, toggleGoal, visibleSteps } from './steps'

describe('journey steps', () => {
  it('the web journey drops the automation step', () => {
    expect(visibleSteps(true)).toHaveLength(6)
    expect(visibleSteps(false)).toEqual(['about', 'goals', 'accounts', 'income', 'budget'])
  })
  it('goals map to the budget priorities without duplicates', () => {
    expect(prioritiesFor(['runout', 'debt'])).toEqual(['safety', 'debt'])
    expect(prioritiesFor(['see', 'budget'])).toEqual([])
    expect(prioritiesFor(['save', 'save'])).toEqual(['goals'])
  })
  it('keeps at most two goals, replacing the oldest', () => {
    expect(toggleGoal([], 'see')).toEqual(['see'])
    expect(toggleGoal(['see', 'save'], 'debt')).toEqual(['save', 'debt'])
    expect(toggleGoal(['see', 'save'], 'see')).toEqual(['save'])
  })
})
