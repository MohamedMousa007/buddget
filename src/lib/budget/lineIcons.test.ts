import { describe, expect, it } from 'vitest'
import { lineIconKey } from '@/lib/budget/lineIcons'
import { PREDEFINED_BUDGET_CATEGORIES } from '@/lib/budget/budgetPlannerPresets'

describe('lineIconKey', () => {
  it('passes a Lucide key through', () => {
    expect(lineIconKey('shield-check')).toBe('shield-check')
  })
  it('maps emoji, with or without the variation selector', () => {
    expect(lineIconKey('🏠')).toBe('house')
    expect(lineIconKey('✈️')).toBe('plane')
    expect(lineIconKey('🛡️')).toBe('shield-check')
  })
  it('falls back to wallet for unknown emoji', () => {
    expect(lineIconKey('🦄')).toBe('wallet')
  })
  it('never returns an emoji for any preset category', () => {
    for (const p of PREDEFINED_BUDGET_CATEGORIES) expect(lineIconKey(p.icon)).toMatch(/^[a-z][a-z0-9-]*$/)
  })
  it('does not use the banned piggy-bank glyph', () => {
    for (const p of PREDEFINED_BUDGET_CATEGORIES) expect(lineIconKey(p.icon)).not.toBe('piggy-bank')
  })
})
