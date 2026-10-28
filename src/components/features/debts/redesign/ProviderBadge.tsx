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
  sympl: '/providers/sympl.webp',
  souhoola: '/providers/souhoola.webp',
  halan: '/providers/halan.svg',
  spotii: '/providers/spotii.svg',
  mispay: '/providers/mispay.png',
  cashew: '/providers/cashew.webp',
  forsa: '/providers/forsa.webp',
  aman: '/providers/aman.png',
  shahry: '/providers/shahry.webp',
  contact: '/providers/contact.webp',
  postpay: '/providers/postpay.png',
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
  const c = color ?? brand?.color ?? 'var(--color-brand-text-muted)'
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
      className={`flex shrink-0 items-center justify-center font-extrabold text-[var(--color-brand-on-primary)] ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: `linear-gradient(140deg, ${c}, color-mix(in oklab, ${c} 72%, black))`,
        boxShadow: `0 4px 12px -4px color-mix(in oklab, ${c} 40%, transparent)`,
        fontSize: size * (monogram(label).length > 2 ? 0.3 : 0.36),
        letterSpacing: '-0.02em',
      }}
    >
      {monogram(label)}
    </span>
  )
}
