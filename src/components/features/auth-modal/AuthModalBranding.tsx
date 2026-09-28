'use client'

import { useT } from '@/lib/i18n'
import { BuddgetWordmark } from '@/components/brand'

export interface AuthModalBrandingProps {
  message: string | null
}

/**
 * Buddget wordmark and optional contextual message above the form.
 */
export function AuthModalBranding({ message }: AuthModalBrandingProps) {
  const t = useT()
  return (
    <div className="text-center mb-3 sm:mb-4">
      <h1 id="auth-modal-title" className="flex justify-center">
        <BuddgetWordmark height={24} />
      </h1>
      <p className="text-xs mt-1 text-[var(--color-brand-text-muted)]">{t.brand.tagline}</p>
      {message ? (
        <p className="mt-3 text-sm text-start rounded-lg border border-[var(--color-brand-primary)]/35 bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary-ink)] px-3 py-2 leading-snug">
          {message}
        </p>
      ) : null}
    </div>
  )
}
