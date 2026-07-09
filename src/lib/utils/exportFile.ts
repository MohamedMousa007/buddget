/**
 * Export a generated file cross-platform.
 *
 * - Native (Capacitor): writes to Directory.Documents via @capacitor/filesystem so
 *   the file is accessible. On iOS also attempts the Web Share sheet; on Android
 *   the file is saved silently and the caller shows a toast.
 * - Mobile/desktop web: prefers Web Share API with a File, falls back to <a download>.
 *
 * Returns 'shared' (share sheet used), 'saved' (written to device Documents),
 * or 'downloaded' (anchor download triggered).
 */
import { isNative, isIOS } from '@/lib/native/isNative'

export async function downloadOrShareFile(
  filename: string,
  content: string,
  mime: string,
): Promise<'shared' | 'saved' | 'downloaded'> {
  if (isNative()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({
      path: filename,
      data: new Blob([content], { type: mime }),
      directory: Directory.Documents,
      recursive: true,
    })

    // iOS WKWebView supports Web Share with File objects — opens the share/save sheet.
    if (isIOS()) {
      try {
        const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
        if (nav.share) {
          const blob = new Blob([content], { type: mime })
          await nav.share({ files: [new File([blob], filename, { type: mime })], title: filename })
          return 'shared'
        }
      } catch {
        // AbortError (cancelled) or unsupported — file is already written to Documents.
      }
    }

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
