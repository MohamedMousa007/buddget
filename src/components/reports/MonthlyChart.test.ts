import { describe, expect, it } from 'vitest'
import { axisTick } from './MonthlyChart'

describe('axisTick', () => {
  it('does not collapse small values to 0k and keeps the minus sign', () => {
    expect(axisTick(0)).toBe('0')
    expect(axisTick(400)).toBe('400')
    expect(axisTick(1500)).toBe('1.5k')
    expect(axisTick(12000)).toBe('12k')
    expect(axisTick(-2000)).toBe('-2k')
  })
})

describe('chart animation honours reduced motion (QA-82)', () => {
  it.each(['MonthlyChart.tsx', 'CategoryPieChart.tsx'])('%s passes isAnimationActive={!reduced}', async (f) => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, f), 'utf8')
    expect(src).toContain('useReducedMotion()')
    expect(src).not.toMatch(/isAnimationActive=\{(true|false)\}/)
    expect(src).toContain('isAnimationActive={!reduced}')
  })
})
