import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useSettingsStore } from './useSettingsStore'

describe('Buddgy figure clearance (QA-111)', () => {
  it('a new install rests the figure on the left edge, away from row amounts and chevrons', () => {
    expect(useSettingsStore.getInitialState().buddgyOrb.side).toBe('left')
  })
  it('main reserves bottom room beyond the nav so the last row scrolls above the figure', () => {
    const shell = readFileSync(join(__dirname, '../../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toContain('pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]')
  })
})
