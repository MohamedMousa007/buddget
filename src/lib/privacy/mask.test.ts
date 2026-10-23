import { describe, expect, it } from 'vitest'
import { isMasked } from './mask'

describe('isMasked', () => {
  it('shows everything by default', () => {
    expect(isMasked(undefined, 'hero')).toBe(false)
    expect(isMasked({}, 'buddgy')).toBe(false)
  })
  it('all hides every surface, hero hides only the hero, custom follows the flags', () => {
    expect(isMasked({ preset: 'all' }, 'widgets')).toBe(true)
    expect(isMasked({ preset: 'hero' }, 'hero')).toBe(true)
    expect(isMasked({ preset: 'hero' }, 'lists')).toBe(false)
    expect(isMasked({ preset: 'custom', lists: true }, 'lists')).toBe(true)
    expect(isMasked({ preset: 'custom', lists: true }, 'hero')).toBe(false)
  })
})
