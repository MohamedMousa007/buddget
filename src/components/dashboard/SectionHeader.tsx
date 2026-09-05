'use client'

import { Children, isValidElement, type ReactNode } from 'react'

/** Icon rendered inline with the title (call site owns color/size — sections use their own brand color). */
function Icon({ children }: { children: ReactNode }) {
  return <>{children}</>
}

function Title({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/** Right-aligned slot: a Link, a StatusChip, or nothing. */
function Trailing({ children }: { children: ReactNode }) {
  return <>{children}</>
}

interface SectionHeaderProps {
  children: ReactNode
}

function SectionHeaderBase({ children }: SectionHeaderProps) {
  const kids = Children.toArray(children)
  const icon = kids.find((c) => isValidElement(c) && c.type === Icon)
  const title = kids.find((c) => isValidElement(c) && c.type === Title)
  const trailing = kids.find((c) => isValidElement(c) && c.type === Trailing)

  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <h2 className="flex shrink-0 items-center gap-2 text-sm font-semibold text-[var(--color-brand-text-primary)]">
        {icon}
        {title}
      </h2>
      {trailing}
    </div>
  )
}

export const SectionHeader = Object.assign(SectionHeaderBase, { Icon, Title, Trailing })
