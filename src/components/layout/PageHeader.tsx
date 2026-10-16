import { cn } from '@/lib/utils'

/** Shared visual surface (no position). */
export const PAGE_HEADER_SURFACE_BASE =
  'bg-[var(--color-brand-bg)]/90 backdrop-blur-xl border-b border-[var(--color-brand-border)]'

/**
 * Sticky app bar inside main + sidebar layout. Clears the fixed app header:
 * mobile header is `--app-header-h + safe-area-inset-top` tall, desktop header is `--app-header-h-lg`
 * (no inset). The inset-aware calc covers both — env() is 0 on desktop.
 */
export const PAGE_HEADER_SURFACE_CLASS = `sticky top-[calc(var(--app-header-h)+env(safe-area-inset-top,0px))] lg:top-[var(--app-header-h-lg)] z-30 ${PAGE_HEADER_SURFACE_BASE}`

/** Full-width routes without DesktopHeaderBar (onboarding, reset-password, etc.). */
export const PAGE_HEADER_BARE_CLASS = `sticky top-0 z-30 ${PAGE_HEADER_SURFACE_BASE}`

export function PageHeader({ children }: { children: React.ReactNode }) {
  return <header className={PAGE_HEADER_SURFACE_CLASS}>{children}</header>
}

/** Horizontal padding + max alignment for header toolbar rows */
export function PageHeaderContent({
  children,
  className,
  width,
}: {
  children: React.ReactNode
  className?: string
  /** Cap the toolbar row to the page content column so actions line up with it. */
  width?: 'narrow' | 'wide'
}) {
  return (
    <div
      className={cn(
        'px-4 py-2.5 lg:px-6',
        width && 'mx-auto w-full',
        width === 'narrow' && 'max-w-[var(--page-max)]',
        width === 'wide' && 'max-w-[var(--page-max-wide)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
