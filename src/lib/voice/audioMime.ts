/**
 * Maps an audio MIME type to a file extension Groq Whisper accepts.
 *
 * Critical for iOS: WKWebView's MediaRecorder produces `audio/mp4` (AAC), never
 * webm. Groq validates the multipart filename's extension against its allow-list
 * (flac, mp3, mp4, mpeg, mpga, m4a, ogg, opus, wav, webm) and rejects a mismatch,
 * so an mp4 blob uploaded as `.webm` fails. Derive the extension from the real
 * blob type instead of hardcoding it.
 */
export function audioMimeToExt(mime: string | null | undefined): string {
  const m = (mime ?? '').toLowerCase()
  // Container types first — a codec hint like `codecs=opus` must not win over
  // the actual container (e.g. `audio/webm;codecs=opus` is webm, not ogg).
  if (m.includes('mp4')) return 'mp4'
  if (m.includes('webm')) return 'webm'
  if (m.includes('ogg')) return 'ogg'
  if (m.includes('wav')) return 'wav'
  if (m.includes('aac')) return 'm4a'
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3'
  if (m.includes('opus')) return 'ogg'
  return 'webm'
}
