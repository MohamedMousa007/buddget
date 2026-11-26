import { describe, expect, it } from 'vitest'
import { isTabbable, trapTarget, type TabCandidate } from './useDialogFocus'

const node = (over: Partial<TabCandidate> = {}): TabCandidate => ({
  tabIndex: 0,
  offsetParent: {},
  getClientRects: () => ({ length: 1 }),
  closest: () => null,
  ...over,
})

describe('isTabbable (focus left the Expense, Money in and Savings sheets)', () => {
  it('skips a disabled button that still carries tabindex="0" (the disabled Save)', () => {
    expect(isTabbable(node({ disabled: true }))).toBe(false)
  })
  it('skips tabindex -1, inert subtrees and nodes with no box', () => {
    expect(isTabbable(node({ tabIndex: -1 }))).toBe(false)
    expect(isTabbable(node({ closest: (s) => (s === '[inert]' ? {} : null) }))).toBe(false)
    expect(isTabbable(node({ offsetParent: null, getClientRects: () => ({ length: 0 }) }))).toBe(false)
  })
  it('keeps a visible control, including a fixed one with no offsetParent', () => {
    expect(isTabbable(node())).toBe(true)
    expect(isTabbable(node({ offsetParent: null }))).toBe(true)
  })
})

describe('trapTarget', () => {
  const [a, b, c] = ['amount', 'note', 'switch']
  const nodes = [a, b, c]

  it('Tab on the last tabbable wraps to the first; Shift+Tab on the first wraps to the last', () => {
    expect(trapTarget(nodes, c, true, false)).toBe(a)
    expect(trapTarget(nodes, a, true, true)).toBe(c)
  })
  it('lets the browser move focus between inner nodes', () => {
    expect(trapTarget(nodes, b, true, false)).toBeNull()
    expect(trapTarget(nodes, b, true, true)).toBeNull()
  })
  it('pulls focus on the panel itself or outside it back in', () => {
    expect(trapTarget(nodes, 'panel', false, false)).toBe(a)
    expect(trapTarget(nodes, 'panel', false, true)).toBe(c)
  })
  it('does nothing with no tabbable node', () => {
    expect(trapTarget([], 'panel', false, false)).toBeNull()
  })
  it('the sheet case: with the disabled Save filtered out, Tab from the switch wraps instead of leaving', () => {
    const save = node({ disabled: true })
    const sw = node()
    const first = node()
    const tabbable = [first, sw, save].filter(isTabbable)
    expect(trapTarget(tabbable, sw, true, false)).toBe(first)
  })
})
