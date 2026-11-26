const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'mif1', 'heif'])

const startsWith = (buf: Uint8Array, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b)
const ascii = (buf: Uint8Array, from: number, to: number) => String.fromCharCode(...buf.subarray(from, to))

/** The image type the leading bytes say it is, or null when they match none of the receipt allow-list. */
export function sniffImageMime(buf: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47])) return 'image/png'
  if (buf.length >= 12 && ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return 'image/webp'
  if (buf.length >= 12 && ascii(buf, 4, 8) === 'ftyp' && HEIF_BRANDS.has(ascii(buf, 8, 12))) return 'image/heic'
  return null
}
