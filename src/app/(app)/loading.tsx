'use client'

import { useT } from '@/lib/i18n'

/**
 * Boot screen.
 *
 * Both themes are expressed as CSS variables set on the element itself, so the
 * pre-hydration theme script (which has already put `.dark` on <html> before
 * this paints) decides which one shows — no flash, no JS branch, and no second
 * component to keep in sync.
 *
 * The teal wash is the brand gradient: a soft radial bloom off the top edge over
 * the theme's page background.
 */
export default function Loading() {
  const t = useT()
  return (
    <div
      className="
        fixed inset-0 z-[var(--z-system)] flex flex-col items-center justify-center gap-4 px-4
        [--boot-bloom:rgba(13,133,120,0.16)]
        [--boot-from:#F4F7F6] [--boot-to:#E6EEEC]
        [--boot-track:rgba(13,26,24,0.12)] [--boot-spin:var(--color-brand-primary)]
        [--boot-text:var(--color-brand-text-secondary)]
        dark:[--boot-bloom:rgba(31,195,178,0.20)]
        dark:[--boot-from:#0E1614] dark:[--boot-to:#070C0B]
        dark:[--boot-track:rgba(234,242,240,0.14)]
      "
      style={{
        background:
          'radial-gradient(120% 60% at 50% -6%, var(--boot-bloom) 0%, transparent 62%), ' +
          'linear-gradient(180deg, var(--boot-from) 0%, var(--boot-to) 100%)',
      }}
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-2"
        style={{ borderColor: 'var(--boot-track)', borderTopColor: 'var(--boot-spin)' }}
      />
      <p className="text-sm" style={{ color: 'var(--boot-text)' }}>
        {t.dashboard.loadingMessage}
      </p>
    </div>
  )
}
