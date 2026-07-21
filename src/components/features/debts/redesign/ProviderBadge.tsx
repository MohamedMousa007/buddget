'use client'

import { findProviderBrand } from '@/lib/constants/installmentProviders'

/**
 * Provider logo badge. Renders the provider's OFFICIAL logo (from `public/providers/`)
 * when one exists — used for nominative identification of the user's plan — else an
 * original brand-coloured monogram badge. Shown on the installment card, the
 * provider-picker grid, and the Add-installment provider field.
 *
 * To add/replace a logo: drop the file in `public/providers/<slug>.<ext>` and add the
 * slug → path entry below. Prefer the provider's official brand-kit asset; follow its
 * usage guidelines, don't recolor/distort it, and never imply an endorsement.
 */
const OFFICIAL_LOGOS: Record<string, string> = {
  tabby: '/providers/tabby.svg',
  tamara: '/providers/tamara.png',
  valu: '/providers/valu.png',
  sympl: '/providers/sympl.png',
  souhoola: '/providers/souhoola.png',
  halan: '/providers/halan.svg',
  spotii: '/providers/spotii.svg',
  mispay: '/providers/mispay.png',
  cashew: '/providers/cashew.png',
  forsa: '/providers/forsa.png',
  aman: '/providers/aman.png',
  shahry: '/providers/shahry.webp',
  contact: '/providers/contact.png',
  // postpay: missing — add '/providers/postpay.<ext>' once obtained.
}

function shade(hex: string, f: number): string {
  const h = hex.replace('#', '')
  const r = Math.round(parseInt(h.slice(0, 2), 16) * f)
  const g = Math.round(parseInt(h.slice(2, 4), 16) * f)
  const b = Math.round(parseInt(h.slice(4, 6), 16) * f)
  return `rgb(${r},${g},${b})`
}

/** Short monogram for a provider (original wordmark-style fallback). */
function monogram(name: string): string {
  const clean = name.replace(/[^A-Za-z ]/g, '').trim()
  if (!clean) return '•'
  const parts = clean.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return clean.slice(0, 3)
}

export interface ProviderBadgeProps {
  slug?: string
  name?: string
  color?: string
  size?: number
  className?: string
}

export function ProviderBadge({ slug, name, color, size = 40, className }: ProviderBadgeProps) {
  const brand = findProviderBrand(slug)
  const label = name ?? brand?.name ?? 'Other'
  const c = color ?? brand?.color ?? '#6B7280'
  const logo = slug ? OFFICIAL_LOGOS[slug] : undefined

  if (logo) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden bg-white ${className ?? ''}`}
        style={{ width: size, height: size, borderRadius: size * 0.26 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static provider logo, no optimization needed */}
        <img src={logo} alt={`${label} logo`} className="h-full w-full object-contain" style={{ padding: size * 0.12 }} />
      </span>
    )
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center font-extrabold text-white ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: `linear-gradient(140deg, ${c}, ${shade(c, 0.72)})`,
        boxShadow: `0 4px 12px -4px ${c}66, inset 0 1px 0 rgba(255,255,255,.25)`,
        fontSize: size * (monogram(label).length > 2 ? 0.3 : 0.36),
        letterSpacing: '-0.02em',
      }}
    >
      {monogram(label)}
    </span>
  )
}
