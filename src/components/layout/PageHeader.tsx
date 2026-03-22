import { cn } from '@/lib/utils'

/** Sticky app bar surface used across most screens */
export const PAGE_HEADER_SURFACE_CLASS =
  'sticky top-0 z-30 bg-[var(--color-brand-bg)]/90 backdrop-blur-xl border-b border-[var(--color-brand-border)]'

export function PageHeader({ children }: { children: React.ReactNode }) {
  return <header className={PAGE_HEADER_SURFACE_CLASS}>{children}</header>
}

/** Horizontal padding + max alignment for header toolbar rows */
export function PageHeaderContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('px-4 py-3 lg:px-8', className)}>{children}</div>
}
