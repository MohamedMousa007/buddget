import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Bell } from 'lucide-react'
import { SettingsChip } from './SettingsRow'

const chip = (props: Partial<Parameters<typeof SettingsChip>[0]>) => renderToStaticMarkup(<SettingsChip icon={Bell} {...props} />)

describe('SettingsChip', () => {
  it('keeps the soft tint by default', () => {
    const html = chip({ tone: 5 })
    expect(html).toContain('color-mix(in oklab, var(--color-cat-5) 15%')
    expect(html).toContain('color:var(--color-cat-5)')
  })
  it('solid is the hue as a fill with the on-fill glyph colour', () => {
    const html = chip({ tone: 5, solid: true })
    expect(html).toContain('background:var(--color-cat-5)')
    expect(html).toContain('color:var(--color-brand-on-primary)')
  })
  it('a neutral solid chip is the secondary text colour, not the soft chip', () => {
    const html = chip({ solid: true })
    expect(html).toContain('background:var(--color-brand-text-secondary)')
  })
})
