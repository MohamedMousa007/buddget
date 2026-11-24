import type { Recap } from './recap'

export interface RecapShareText {
  title: string
  spent: string
  kept: string | null
  top: string | null
  purchases: string
  foot: string
}

/** The recap as sharable text: percentages and names only, never an amount. */
export function recapShareText(
  recap: Recap,
  t: { title: string; spent: (pct: number | null, up: boolean) => string; kept: (share: number, positive: boolean) => string; top: (name: string) => string; purchases: (n: number) => string; foot: string },
  categoryName: (raw: string) => string,
): RecapShareText {
  const delta = recap.spentBefore && recap.spentBefore > 0 ? Math.round(((recap.spent - recap.spentBefore) / recap.spentBefore) * 100) : null
  const keptNet = recap.received - recap.spent
  return {
    title: t.title,
    spent: t.spent(delta === null ? null : Math.abs(delta), (delta ?? 0) > 0),
    kept: recap.received > 0 ? t.kept(Math.round((Math.abs(keptNet) / recap.received) * 100), keptNet >= 0) : null,
    top: recap.topCategory ? t.top(categoryName(recap.topCategory.name)) : null,
    purchases: t.purchases(recap.purchases),
    foot: t.foot,
  }
}

/** Resolves a token (or color-mix of tokens) to a colour the canvas understands. */
function cssColor(value: string): string {
  const probe = document.createElement('span')
  probe.style.color = value
  document.body.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  return resolved
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

/** A story-sized card in the app's colours. Resolves to the PNG, or null where canvas is unavailable. */
export async function renderRecapImage(text: RecapShareText, rtl: boolean): Promise<Blob | null> {
  if (typeof document === 'undefined') return null
  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, cssColor('var(--flow-band-a)'))
  grad.addColorStop(1, cssColor('var(--flow-band-b)'))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  const fg = cssColor('var(--flow-band-fg)')
  ctx.fillStyle = fg
  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textAlign = 'center'
  ctx.font = '600 44px ui-sans-serif, system-ui, sans-serif'
  ctx.globalAlpha = 0.8
  ctx.fillText(text.title, W / 2, 150)
  ctx.globalAlpha = 1
  let y = 340
  for (const line of [text.spent, text.kept, text.top, text.purchases]) {
    if (!line) continue
    ctx.font = '800 76px ui-sans-serif, system-ui, sans-serif'
    for (const part of wrap(ctx, line, W - 180)) {
      ctx.fillText(part, W / 2, y)
      y += 96
    }
    y += 70
  }
  ctx.globalAlpha = 0.75
  ctx.font = '600 40px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(text.foot, W / 2, H - 110)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

/** Shares the image through the system sheet, or downloads it where sharing files is unsupported. */
export async function shareRecapImage(text: RecapShareText, rtl: boolean): Promise<'shared' | 'downloaded' | 'failed'> {
  const blob = await renderRecapImage(text, rtl)
  if (!blob) return 'failed'
  const file = new File([blob], 'buddget-recap.png', { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: text.title })
      return 'shared'
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'shared'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'downloaded'
}
