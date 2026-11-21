import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { LOGO_POLICY, logoAllowed } from './logoPolicy'

const PUBLIC = join(process.cwd(), 'public/subscription-icons')

/** Width and height from a WebP header (lossy VP8, lossless VP8L or extended VP8X). */
function webpSize(buf: Buffer): { width: number; height: number } {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') throw new Error('not a WebP')
  const chunk = buf.toString('ascii', 12, 16)
  if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
  if (chunk === 'VP8L') {
    const b = buf.readUInt32LE(21)
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 }
  throw new Error(`unknown WebP chunk ${chunk}`)
}

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

  it('every logo is a square WebP of at least 512px, crisp at @3x on the largest tile', () => {
    for (const [key, policy] of Object.entries(LOGO_POLICY)) {
      if (policy !== 'logo') continue
      const { width, height } = webpSize(readFileSync(join(PUBLIC, `${key}.webp`)))
      expect(width, key).toBe(height)
      expect(width, key).toBeGreaterThanOrEqual(512)
    }
  })

  it('treats unknown brands as initials', () => {
    expect(logoAllowed('some_new_brand')).toBe(false)
    expect(logoAllowed(null)).toBe(false)
  })
})
