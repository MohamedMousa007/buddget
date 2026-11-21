import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { bankLogoBg } from '@/lib/payment/bankLogos'
import { inkOn, monogram } from './accountDisplay'

interface BrandMarkProps {
  name: string
  color: string
  /** px; the list uses 44, pickers 32–36. */
  size?: number
  /** Amber exception badge (a gap to resolve). */
  alert?: boolean
  icon?: ReactNode
  /** The bank's official logo (see `bankLogoForName`): drawn padded on a white tile in both themes (or on `logoBg`). Absent = the monogram. */
  logo?: string | null
  /** Tile colour behind a light-on-dark logo. Absent = the bank's own (`bankLogoBg`); null or none = white. */
  logoBg?: string | null
  className?: string
}

/** The squircle monogram that stands for a bank, wallet or cash. */
export function BrandMark({ name, color, size = 44, alert, icon, logo, logoBg, className }: BrandMarkProps) {
  const radius = size * 0.32
  const tileBg = logo ? (logoBg === undefined ? bankLogoBg(logo) : logoBg) : null
  return (
    <span
      aria-hidden
      data-brand-logo={logo ? '' : undefined}
      className={cn('relative inline-flex shrink-0 items-center justify-center', logo ? (tileBg ? 'ring-1 ring-inset ring-white/20' : 'bg-white ring-1 ring-inset ring-[var(--color-brand-border)]') : 'font-bold', className)}
      style={logo
        ? { width: size, height: size, borderRadius: radius, background: tileBg ?? undefined }
        : { width: size, height: size, borderRadius: radius, background: color, color: inkOn(color), fontSize: size * 0.27, letterSpacing: '0.02em' }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- static bank logo from public/, no optimisation in the static export
        <img src={logo} alt="" draggable={false} className="size-full object-contain" style={{ padding: size * 0.14, borderRadius: radius }} />
      ) : (icon ?? monogram(name))}
      {alert ? (
        <span className="absolute -end-1 -top-1 flex size-[18px] items-center justify-center rounded-full border-2 border-[var(--color-brand-card)] bg-[var(--color-brand-amber)] text-[0.625rem] font-extrabold text-[var(--color-brand-card)]">!</span>
      ) : null}
    </span>
  )
}
