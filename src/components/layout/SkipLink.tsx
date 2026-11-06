'use client'

import { useT } from '@/lib/i18n'
import { MAIN_ID } from './routeAnnounce'

/** First tab stop on desktop: jumps past the sidebar to `<main>`. Visible only while focused. */
export function SkipLink() {
  const label = useT().a11y.skipToContent
  return (
    <a
      href={`#${MAIN_ID}`}
      onClick={(e) => {
        e.preventDefault()
        document.getElementById(MAIN_ID)?.focus()
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[var(--z-system)] focus:rounded-lg focus:bg-[var(--color-brand-card)] focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-[var(--color-brand-text-primary)] focus:shadow-[var(--shadow-lg)] focus:outline focus:outline-2 focus:outline-[var(--color-brand-focus)]"
    >
      {label}
    </a>
  )
}
