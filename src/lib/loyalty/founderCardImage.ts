/**
 * The founder card as a PNG, drawn on a canvas so it needs no new dependency. Colours are read from the page's own tokens
 * (--member-gold-hi, --member-gold-mid, --auth-floor stops), so the image matches the card on screen in either theme.
 */
export async function founderCardImage(opts: { number: string; mark: string; wordmark: string }): Promise<Blob | null> {
  const W = 1080
  const H = 680
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const css = getComputedStyle(document.documentElement)
  const gold = css.getPropertyValue('--member-gold-hi').trim() || '#EDC463'
  const goldDeep = css.getPropertyValue('--member-gold-mid').trim() || '#B68E30'

  const floor = ctx.createLinearGradient(0, 0, W, H)
  floor.addColorStop(0, '#0E1614')
  floor.addColorStop(1, '#070C0B')
  ctx.fillStyle = floor
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, W * 0.7)
  glow.addColorStop(0, `${gold}33`)
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const foil = ctx.createLinearGradient(0, 0, W, 0)
  foil.addColorStop(0, gold)
  foil.addColorStop(0.5, goldDeep)
  foil.addColorStop(1, gold)
  ctx.fillStyle = foil
  ctx.font = '800 40px system-ui, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(opts.mark.split('').join(' '), 72, 120)
  ctx.font = '600 260px ui-monospace, Menlo, monospace'
  ctx.fillText(opts.number, 64, 420)
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = '700 44px system-ui, sans-serif'
  ctx.fillText(opts.wordmark, 72, H - 72)

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

/** Shares the image where the platform can share files, otherwise saves it. Resolves false when neither worked. */
export async function shareOrSaveImage(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: 'image/png' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] })
      return true
    }
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return true
  }
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5_000)
    return true
  } catch {
    return false
  }
}
