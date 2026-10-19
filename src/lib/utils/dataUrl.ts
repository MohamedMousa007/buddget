/**
 * Decodes a base64 `data:` URL into its MIME type and bytes without `fetch`. The web build's
 * Content-Security-Policy `connect-src` does not allow `data:`, so `fetch(dataUrl)` is blocked there.
 */
export function dataUrlToBytes(dataUrl: string): { mime: string; bytes: Uint8Array<ArrayBuffer> } {
  const match = /^data:([^;,]*)(?:;[^,]*)*?;base64,([\s\S]*)$/.exec(dataUrl)
  if (!match) throw new Error('Not a base64 data URL')
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { mime: match[1] || 'application/octet-stream', bytes }
}
