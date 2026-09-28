import { describe, it, expect } from 'vitest'
import { iconButtonVariants } from '@/components/ui/IconButton'
import { optionChipVariants } from '@/components/ui/OptionChip'
import { selectableCardVariants } from '@/components/ui/SelectableCard'

/**
 * These assert the *contract* of the shared button primitives, not their looks.
 *
 * There is no DOM test environment in this repo (vitest runs in node), so the
 * variant functions are checked directly. That is enough to catch the regressions
 * that actually matter here: a tap target dropping below 44px, or a selected state
 * losing its visual distinction — both of which are how the 118 hand-rolled buttons
 * these replace went wrong in the first place.
 */
describe('IconButton', () => {
  it('guarantees a 44px hit area at every size', () => {
    for (const size of ['sm', 'md', 'lg', 'xl'] as const) {
      const cls = iconButtonVariants({ size })
      expect(cls, `size=${size}`).toContain('after:min-h-[44px]')
      expect(cls, `size=${size}`).toContain('after:min-w-[44px]')
    }
  })

  it('keeps the 32px visual size distinct from the hit area', () => {
    // `sm` is deliberately smaller than 44px *visually* — the after: overlay is
    // what satisfies the rule. If someone "fixes" sm to size-11 the row layouts
    // that depend on a dense glyph silently grow.
    expect(iconButtonVariants({ size: 'sm' })).toContain('size-8')
    expect(iconButtonVariants({ size: 'md' })).toContain('size-11')
  })

  it('centres the hit overlay, so it grows symmetrically around a small glyph', () => {
    const cls = iconButtonVariants({ size: 'sm' })
    expect(cls).toContain('after:left-1/2')
    expect(cls).toContain('after:-translate-x-1/2')
  })
})

describe('OptionChip', () => {
  it('distinguishes selected from unselected by more than one property', () => {
    const on = optionChipVariants({ selected: true })
    const off = optionChipVariants({ selected: false })
    expect(on).not.toEqual(off)
    // Border AND fill both change, so the state survives a forced-colours mode
    // that discards background-color.
    expect(on).toContain('border-[var(--color-brand-primary)]')
    expect(on).toContain('bg-[var(--color-brand-primary-soft)]')
  })

  it('uses the segment size for a full-width row of equal choices', () => {
    expect(optionChipVariants({ size: 'segment' })).toContain('flex-1')
    expect(optionChipVariants({ size: 'segment' })).toContain('h-11')
  })
})

describe('SelectableCard', () => {
  it('marks the selected card with a teal border as well as a fill', () => {
    const on = selectableCardVariants({ selected: true })
    expect(on).toContain('border-[var(--color-brand-primary)]')
    expect(on).toContain('bg-[var(--color-brand-primary-soft)]')
  })

  it('keeps every layout at least 44px tall where it is a tappable row', () => {
    expect(selectableCardVariants({ layout: 'row' })).toContain('min-h-[52px]')
    expect(selectableCardVariants({ layout: 'list' })).toContain('min-h-11')
  })
})
