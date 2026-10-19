import { describe, expect, it } from 'vitest'
import { reconcileTyped } from '@/lib/ui/typedAmount'

describe('reconcileTyped', () => {
  it('keeps text that still means the stored number, so a trailing dot or an empty box survives', () => {
    expect(reconcileTyped('1.', 1)).toBe('1.')
    expect(reconcileTyped('', 0)).toBe('')
    expect(reconcileTyped('0.50', 0.5)).toBe('0.50')
  })
  it('shows the stored number when it changed from elsewhere', () => {
    expect(reconcileTyped('1.', 900)).toBe('900')
  })
})
