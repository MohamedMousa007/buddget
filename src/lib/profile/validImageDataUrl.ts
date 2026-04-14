/**
 * Rejects non-image data URLs and malformed payloads before storing in profile / img src.
 */
export function isValidImageDataUrl(url: string): boolean {
  const s = url.trim()
  if (s.length > 8_000_000) return false
  return /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(s)
}
