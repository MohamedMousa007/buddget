/**
 * Export a generated file cross-platform.
 *
 * Native: tries Web Share API first — Android WebView (Chrome 75+) and iOS WKWebView
 * both support file sharing via navigator.share. iOS fallback: write to app Documents
 * (visible in Files app). Android fallback: write to app Documents (app-private).
 * Web: prefers Web Share with File, falls back to <a download>.
 *
 * Returns 'shared' (share sheet used), 'saved' (written to device Documents),
 * or 'downloaded' (anchor download triggered).
 */
import { isNative } from '@/lib/native/isNative'

export async function downloadOrShareFile(
  filename: string,
  content: string,
  mime: string,
): Promise<'shared' | 'saved' | 'downloaded'> {
  if (isNative()) {
    // Try Web Share API on all native platforms first.
    // Android WebView (Chrome 75+) and iOS WKWebView both support file sharing.
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
    if (nav.share) {
      try {
        const blob = new Blob([content], { type: mime })
        await nav.share({ files: [new File([blob], filename, { type: mime })], title: filename })
        return 'shared'
      } catch (err) {
        // AbortError = user dismissed the share sheet; that is fine.
        if ((err as Error)?.name === 'AbortError') return 'shared'
        // Other errors: share unavailable — fall through to Filesystem.
      }
    }

    // Filesystem fallback: iOS Documents is visible in the Files app;
    // Android Documents is app-private but at least preserves the file.
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Documents,
      recursive: true,
    })
    return 'saved'
  }

  const blob = new Blob([content], { type: mime })
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }

  if (typeof File !== 'undefined' && nav.canShare && nav.share) {
    const file = new File([blob], filename, { type: mime })
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: filename })
        return 'shared'
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return 'shared'
      }
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
