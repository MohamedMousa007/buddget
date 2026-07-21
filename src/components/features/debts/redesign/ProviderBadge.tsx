'use client'

import type { ReactNode } from 'react'
import { findProviderBrand } from '@/lib/constants/installmentProviders'

/**
 * Provider logo badge. Renders an ORIGINAL brand-coloured mark per provider
 * (our own artwork, not a copy of any official logo). To use an official logo,
 * register its inline SVG in `OFFICIAL_LOGOS[slug]` — it then renders here, in
 * the picker, and on the installment card (handoff §9, one-file swap).
 */

/**
 * Official brand logos — ONE-FILE DROP-IN.
 *
 * Displaying a provider's logo to identify that provider's plan is nominative
 * (referential) use and generally permitted; obtain each asset from the provider's
 * OFFICIAL brand/press kit, follow its usage guidelines, don't recolor/distort it,
 * and never imply the provider endorses this app. Paste the official SVG as JSX
 * (viewBox "0 0 24 24" recommended) against its catalogue slug below and it renders
 * everywhere — the installment card, the provider-picker grid, and the provider field.
 * Until an entry exists, the provider falls back to an original brand-coloured badge.
 *
 * Example:
 *   valu: <svg viewBox="0 0 24 24"><path d="…" fill="#F04E23" /></svg>,
 */
const OFFICIAL_LOGOS: Record<string, ReactNode> = {
  // valu: …,   tabby: …,   tamara: …,   sympl: …,
  // postpay: …, cashew: …, spotii: …, mispay: …,
  // souhoola: …, aman: …, contact: …, halan: …, shahry: …, forsa: …,
}

function shade(hex: string, f: number): string {
  const h = hex.replace('#', '')
  const r = Math.round(parseInt(h.slice(0, 2), 16) * f)
  const g = Math.round(parseInt(h.slice(2, 4), 16) * f)
  const b = Math.round(parseInt(h.slice(4, 6), 16) * f)
  return `rgb(${r},${g},${b})`
}

/** Short monogram for a provider (original wordmark-style). */
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
  const official = slug ? OFFICIAL_LOGOS[slug] : undefined

  if (official) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden ${className ?? ''}`}
        style={{ width: size, height: size, borderRadius: size * 0.26, background: '#fff' }}
      >
        {official}
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
