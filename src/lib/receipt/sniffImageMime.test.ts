import { describe, expect, it } from 'vitest'
import { sniffImageMime } from '@/lib/receipt/sniffImageMime'

const bytes = (...b: number[]) => Uint8Array.from([...b, ...new Array(16).fill(0)])
const text = (s: string) => [...s].map((c) => c.charCodeAt(0))

describe('sniffImageMime', () => {
  it('recognises jpeg, png, webp and heif', () => {
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47))).toBe('image/png')
    expect(sniffImageMime(bytes(...text('RIFF'), 0, 0, 0, 0, ...text('WEBP')))).toBe('image/webp')
    expect(sniffImageMime(bytes(0, 0, 0, 0x18, ...text('ftyp'), ...text('heic')))).toBe('image/heic')
    expect(sniffImageMime(bytes(0, 0, 0, 0x18, ...text('ftyp'), ...text('mif1')))).toBe('image/heic')
  })

  it('rejects other content and short buffers', () => {
    expect(sniffImageMime(bytes(...text('<svg')))).toBeNull()
    expect(sniffImageMime(bytes(...text('RIFF'), 0, 0, 0, 0, ...text('WAVE')))).toBeNull()
    expect(sniffImageMime(bytes(0, 0, 0, 0x18, ...text('ftyp'), ...text('mp42')))).toBeNull()
    expect(sniffImageMime(new Uint8Array([0xff]))).toBeNull()
  })
})
