import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mix } from './color'

describe('mix', () => {
  it('builds a theme-following alpha tint of any colour', () => {
    expect(mix('var(--color-brand-red)', 25)).toBe('color-mix(in oklab, var(--color-brand-red) 25%, transparent)')
    expect(mix('black', 72)).toBe('color-mix(in oklab, black 72%, transparent)')
  })
})

describe('no hard-coded colours in the UIS8 surfaces', () => {
  const FILES = [
    'components/features/payments/PaymentMethodSetupSheet.tsx',
    'components/voice/VoiceRecordSheet.tsx',
    'components/voice/VoiceRecordOverlay.tsx',
    'components/features/income/PaydayTimeline.tsx',
  ]
  it.each(FILES)('%s has no hex or rgb() literal', (file) => {
    const code = readFileSync(resolve(__dirname, '../../', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? []).toEqual([])
  })
})
