import type { ReactNode } from 'react'

interface LegalSectionProps {
  title: string
  children: ReactNode
}

/**
 * Shared prose section wrapper used in all /legal/* pages.
 * Renders a left-accent heading and relaxed body copy.
 */
export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className="space-y-3 scroll-mt-20" aria-labelledby={title.replace(/\s+/g, '-').toLowerCase()}>
      <h2
        id={title.replace(/\s+/g, '-').toLowerCase()}
        className="text-base font-semibold text-[var(--color-brand-text-primary)] border-l-2 border-[var(--color-brand-red)] pl-3"
      >
        {title}
      </h2>
      <div className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed space-y-2 pl-3">
        {children}
      </div>
    </section>
  )
}
