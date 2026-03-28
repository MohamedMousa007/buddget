'use client'

import type { SettingsImportBannerState } from '@/hooks/useSettingsPage'

export interface SettingsImportBannerProps {
  banner: SettingsImportBannerState | null
}

/**
 * Success / error toast after JSON import.
 */
export function SettingsImportBanner({ banner }: SettingsImportBannerProps) {
  if (!banner) return null
  return (
    <div
      role="status"
      className={`rounded-xl border px-4 py-3 text-sm ${
        banner.variant === 'success'
          ? 'border-[var(--color-brand-green)]/40 bg-[var(--color-brand-green)]/10 text-[var(--color-brand-green)]'
          : 'border-[var(--color-brand-red)]/50 bg-red-950/30 text-[var(--color-brand-red)]'
      }`}
    >
      {banner.text}
    </div>
  )
}
