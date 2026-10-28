import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { LOGO_POLICY, logoAllowed } from './logoPolicy'

const PUBLIC = join(process.cwd(), 'public/subscription-icons')

describe('logo policy', () => {
  it('ships a WebP for every allowed brand', () => {
    for (const [key, policy] of Object.entries(LOGO_POLICY)) {
      if (policy === 'logo') expect(existsSync(join(PUBLIC, `${key}.webp`)), key).toBe(true)
    }
  })

  it('ships no image for a brand that is not allowed to show its logo', () => {
    for (const file of readdirSync(PUBLIC)) {
      const key = file.replace(/\.webp$/, '')
      expect(logoAllowed(key), `${key} is bundled but not allowed`).toBe(true)
    }
  })

  it('treats unknown brands as initials', () => {
    expect(logoAllowed('some_new_brand')).toBe(false)
    expect(logoAllowed(null)).toBe(false)
  })
})
