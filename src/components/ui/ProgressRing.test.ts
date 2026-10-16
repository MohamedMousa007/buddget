import { describe, expect, it } from 'vitest'
import { ringDash } from './ProgressRing'

describe('ringDash', () => {
  it('clamps the arc to 0-100%', () => {
    const full = ringDash(100, 10).dash
    expect(ringDash(250, 10).dash).toBeCloseTo(full)
    expect(ringDash(-5, 10).dash).toBe(0)
    expect(ringDash(50, 10).dash).toBeCloseTo(full / 2)
  })
})
