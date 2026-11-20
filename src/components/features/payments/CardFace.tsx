import type { CSSProperties, ReactNode } from 'react'
import { Check } from 'lucide-react'
import { CARD_THEMES, CHIP_FILL, type CardStyle, type CardThemeKey } from '@/lib/payment/cardThemes'
import { INK_DARK, INK_LIGHT } from '@/lib/ui/contrast'

export const FACE_W = 340
export const FACE_H = 214

/** Ink, background and print-line colour shared by the large face and the mini card. */
export function faceLook(themeKey: CardThemeKey, style: CardStyle, brushAlpha: { light: number; dark: number }) {
  const t = CARD_THEMES[themeKey]
  const lightInk = t.ink === 'light'
  const metal = style === 'metal'
  const brushed = metal
    ? `repeating-linear-gradient(90deg, rgba(255,255,255,${lightInk ? brushAlpha.light : brushAlpha.dark}) 0 1px, transparent 1px 3px), `
    : ''
  return {
    lightInk,
    metal,
    ink: lightInk ? INK_LIGHT : INK_DARK,
    background: `${brushed}linear-gradient(135deg, ${t.a} 0%, ${t.b} 100%)`,
  }
}

export interface CardFaceProps {
  theme: CardThemeKey
  style: CardStyle
  /** The bank's name as the user knows it ("Nile Crest Bank"). */
  bank: string
  /** Localized card type ("Credit"). */
  kind: string
  last4?: string
  /** Bottom-left line: the card's label, or nothing. */
  holder?: string
  /** Shown top-right when nothing else sits there. */
  currency?: string
  /** VISA / MASTERCARD when the card's name states one; the network box is hidden otherwise. */
  network?: string | null
  /** Pill text when this is the default method; omit for none. */
  defaultLabel?: string
  selected?: boolean
  /** Keep the top-right corner free for a control the caller lays over the face (the manage button). */
  reserveTopRight?: boolean
  /** Rendered width / 340. */
  scale?: number
  className?: string
  /** Laid over the face, unscaled (so a control there keeps its 44px tap area). */
  children?: ReactNode
}

/**
 * The large card face from the approved design board: 340×214, radius 13, in Metal (brushed, engraved type, steel chip,
 * short number) or Bank-issued (printed guilloche lines, gold chip, contactless mark, full masked number). Drawn at
 * 340 and scaled, so every size keeps the board's proportions. Always LTR, like a physical card.
 */
export function CardFace({
  theme, style, bank, kind, last4, holder, currency, network, defaultLabel, selected = false, reserveTopRight = false, scale = 1, className, children,
}: CardFaceProps) {
  const f = faceLook(theme, style, { light: 0.04, dark: 0.2 })
  const line = f.lightInk ? 'rgba(255,255,255,.07)' : 'rgba(4,32,28,.07)'
  const engrave = f.metal
    ? (f.lightInk ? '0 1px 0 rgba(0,0,0,.8), 0 -1px 0 rgba(255,255,255,.08)' : '0 1px 0 rgba(255,255,255,.55)')
    : (f.lightInk ? '0 1px 0 rgba(0,0,0,.45), 0 -1px 0 rgba(255,255,255,.16)' : '0 1px 0 rgba(255,255,255,.5)')
  const numberText = last4 ? (f.metal ? `•••• ${last4}` : `•••• •••• •••• ${last4}`) : '••••'
  const face: CSSProperties = {
    width: FACE_W, height: FACE_H, padding: '18px 20px', borderRadius: 13, color: f.ink, background: f.background,
    boxShadow: `0 24px 40px -18px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,${f.lightInk ? '.14' : '.55'}), inset 0 -1px 0 rgba(0,0,0,.25)`,
    outline: selected ? '3px solid var(--color-brand-green)' : 'none', outlineOffset: 3,
    transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: 'top left',
  }
  const chip = f.metal ? (f.lightInk ? CHIP_FILL.metalOnDark : CHIP_FILL.metalOnLight) : CHIP_FILL.gold
  return (
    <div dir="ltr" className={`relative shrink-0 ${className ?? ''}`} style={{ width: FACE_W * scale, height: FACE_H * scale }}>
      <div className="absolute left-0 top-0 box-border flex flex-col overflow-hidden" style={face}>
        {!f.metal ? (
          <svg className="absolute left-0 top-0" width={FACE_W} height={FACE_H} viewBox="0 0 340 214" aria-hidden>
            {[150, 161, 172, 183].map((y) => (
              <path key={y} d={`M-10 ${y} C60 ${y - 40}, 120 ${y + 40}, 200 ${y - 10} S300 ${y - 60}, 360 ${y - 30}`} fill="none" stroke={line} strokeWidth={1} />
            ))}
            <circle cx={300} cy={30} r={92} fill={line} />
          </svg>
        ) : null}
        <i
          aria-hidden
          className="absolute inset-0"
          style={{ background: f.metal ? 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,.12) 46%, transparent 62%)' : 'radial-gradient(120% 90% at 85% 8%, rgba(255,255,255,.12), transparent 60%)' }}
        />
        <div className="relative flex min-h-[34px] items-start justify-between gap-2.5">
          <div className="min-w-0">
            <span
              className="block truncate font-bold"
              style={{ fontSize: f.metal ? 12 : 15, letterSpacing: f.metal ? '.16em' : '.01em', textTransform: f.metal ? 'uppercase' : 'none', textShadow: engrave }}
            >
              {bank}
            </span>
            <span className="mt-0.5 block text-[0.59375rem] font-bold uppercase tracking-[0.16em]" style={{ textShadow: engrave }}>{kind}</span>
          </div>
          {selected ? (
            <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-[var(--color-brand-green)] text-[var(--color-brand-on-green)] shadow-[0_2px_6px_rgba(0,0,0,.25)]">
              <Check className="size-[15px]" strokeWidth={3} aria-hidden />
            </span>
          ) : reserveTopRight ? (
            <span aria-hidden className="size-8 shrink-0" />
          ) : currency ? (
            <span className="font-mono-numbers text-[0.6875rem] font-semibold" style={{ textShadow: engrave }}>{currency}</span>
          ) : null}
        </div>
        <div className="relative mt-4 flex items-center gap-3">
          <i aria-hidden className="h-[34px] w-11 shrink-0 rounded-md" style={{ background: chip, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.28)' }} />
          {!f.metal ? (
            <svg width="18" height="22" viewBox="0 0 18 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
              <path d="M3 7.5c1.2 2.2 1.2 4.8 0 7" /><path d="M7 5c2 3.6 2 8.4 0 12" /><path d="M11 2.5c2.8 5.2 2.8 11.8 0 17" />
            </svg>
          ) : null}
          {defaultLabel ? (
            <span
              className="ms-auto rounded-full px-[9px] py-[3px] text-[0.625rem] font-bold uppercase tracking-[0.06em]"
              style={{ background: f.lightInk ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.55)' }}
            >
              {defaultLabel}
            </span>
          ) : null}
        </div>
        <div className="relative mt-auto">
          <span
            className="block whitespace-nowrap font-mono-numbers font-medium"
            style={{ fontSize: f.metal ? 16 : 17, letterSpacing: f.metal ? '.2em' : '.14em', textShadow: engrave }}
          >
            {numberText}
          </span>
          <div className="mt-2 flex min-h-[30px] items-end justify-between gap-2.5">
            <span className="truncate text-[0.6875rem] font-semibold uppercase tracking-[0.12em]" style={{ textShadow: engrave }}>{holder ?? ''}</span>
            {network ? (
              <span
                className="grid h-[30px] min-w-[52px] shrink-0 place-items-center rounded-md px-1 text-[0.4375rem] font-extrabold tracking-[0.1em]"
                style={{ border: `1px solid ${f.lightInk ? 'rgba(255,255,255,.45)' : 'rgba(4,32,28,.4)'}` }}
              >
                {network}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}
