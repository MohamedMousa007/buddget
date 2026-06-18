/**
 * Export a generated file cross-platform.
 *
 * Native (Capacitor WebView) and mobile browsers can't trigger an `<a download>`,
 * so we prefer the Web Share API with a `File` — this opens the OS share sheet
 * (Save to Files, AirDrop, email, etc.). On desktop web we fall back to the
 * classic anchor-download.
 */
export async function downloadOrShareFile(
  filename: string,
  content: string,
  mime: string,
): Promise<void> {
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
        return
      } catch (err) {
        // User dismissed the share sheet — nothing more to do.
        if ((err as Error)?.name === 'AbortError') return
        // Any other share failure falls through to the download path.
      }
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
