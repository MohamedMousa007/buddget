import { describe, expect, it } from 'vitest'
import { dataUrlToBytes } from '@/lib/utils/dataUrl'

describe('dataUrlToBytes', () => {
  it('decodes the mime type and bytes of a base64 data URL', () => {
    const { mime, bytes } = dataUrlToBytes('data:image/jpeg;base64,/9j/4AAQ')
    expect(mime).toBe('image/jpeg')
    expect(Array.from(bytes)).toEqual([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
  })
  it('accepts extra parameters before ;base64', () => {
    expect(dataUrlToBytes('data:image/png;charset=utf-8;base64,iVBORw==').mime).toBe('image/png')
  })
  it('handles large payloads', () => {
    const big = 'A'.repeat(400_000)
    expect(dataUrlToBytes(`data:image/png;base64,${big}`).bytes.length).toBe(300_000)
  })
  it('rejects non-base64 and malformed input', () => {
    expect(() => dataUrlToBytes('data:text/plain,hello')).toThrow()
    expect(() => dataUrlToBytes('https://example.com/a.png')).toThrow()
  })
})
