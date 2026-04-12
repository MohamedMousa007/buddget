'use client'

import { useT } from '@/lib/i18n'

export interface AuthModalBrandingProps {
  message: string | null
}

/**
 * Buddget wordmark and optional contextual message above the form.
 */
export function AuthModalBranding({ message }: AuthModalBrandingProps) {
  const t = useT()
  return (
    <div className="text-center mb-5">
      <h1
        id="auth-modal-title"
        className="text-2xl font-extrabold tracking-tight"
        style={{ fontFamily: 'var(--font-heading), var(--font-sans)' }}
      >
        <span className="text-[var(--color-brand-text-primary)]">Bud</span>
        <span className="text-[var(--color-brand-red)]">d</span>
        <span className="text-[var(--color-brand-text-primary)]">get</span>
      </h1>
      <p className="text-sm mt-1 text-[var(--color-brand-text-muted)]">{t.brand.tagline}</p>
      {message ? (
        <p className="mt-3 text-sm text-start rounded-lg border border-[var(--color-brand-red)]/35 bg-[var(--color-brand-red)]/10 text-[var(--color-brand-red)] px-3 py-2 leading-snug">
          {message}
        </p>
      ) : null}
    </div>
  )
}
