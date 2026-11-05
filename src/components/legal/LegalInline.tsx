import type { ReactNode } from 'react'

const LINK = 'text-[var(--color-brand-primary-ink)] hover:underline'

/** Bold lead-in label of a legal paragraph. */
export function Strong({ children }: { children: ReactNode }) {
  return <strong className="text-[var(--color-brand-text-primary)]">{children}</strong>
}

/** The support address, kept left-to-right inside right-to-left text. */
export function SupportMail() {
  return <a href="mailto:support@buddget.app" dir="ltr" className={LINK}>support@buddget.app</a>
}

/** An external policy link. */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} className={LINK} target="_blank" rel="noopener noreferrer">{children}</a>
}
