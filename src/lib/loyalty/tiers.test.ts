import { describe, expect, it } from 'vitest'
import { tierFor } from './tiers'

const tiers = [{ key: 'silver', min_points: 500 }, { key: 'bronze', min_points: 100 }, { key: 'gold', min_points: 2000 }]

describe('tierFor', () => {
  it('is null below the first tier', () => expect(tierFor(99, tiers)).toBeNull())
  it('picks the highest reached tier regardless of order', () => {
    expect(tierFor(100, tiers)).toBe('bronze')
    expect(tierFor(1999, tiers)).toBe('silver')
    expect(tierFor(2000, tiers)).toBe('gold')
  })
})
