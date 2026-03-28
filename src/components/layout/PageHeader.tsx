import { cn } from '@/lib/utils'

/** Shared visual surface (no position). */
export const PAGE_HEADER_SURFACE_BASE =
  'bg-[var(--color-brand-bg)]/90 backdrop-blur-xl border-b border-[var(--color-brand-border)]'

/**
 * Sticky app bar inside main + sidebar layout.
 * `top-[52px]` clears the fixed app header (DesktopHeaderBar on all breakpoints).
 */
export const PAGE_HEADER_SURFACE_CLASS = `sticky top-[52px] z-30 ${PAGE_HEADER_SURFACE_BASE}`

/** Full-width routes without DesktopHeaderBar (onboarding, reset-password, etc.). */
export const PAGE_HEADER_BARE_CLASS = `sticky top-0 z-30 ${PAGE_HEADER_SURFACE_BASE}`

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
