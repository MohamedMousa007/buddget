'use client'

import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { IconButton } from '@/components/ui/IconButton'
import { useT } from '@/lib/i18n'

function Header({ title, onClose, onBack }: { title: string; onClose: () => void; onBack?: () => void }) {
  const t = useT()
  return (
    <V3SheetHeader
      onClose={onClose}
      leading={
        onBack ? (
          <IconButton aria-label={t.common.back} onClick={onBack} className="-ms-3">
            <ChevronLeft strokeWidth={1.75} className="text-[var(--color-brand-text-secondary)] rtl:rotate-180" />
          </IconButton>
        ) : undefined
      }
    >
      <V3SheetHeader.Title size="compact">{title}</V3SheetHeader.Title>
    </V3SheetHeader>
  )
}

/**
 * The Subscriptions sheet: header (title + 44px close), scrolling body, and a pinned footer
 * carrying the one primary action. A bottom sheet on phones (48px gap above, 24px top
 * radius); a centred 28rem dialog from tablet up.
 */
export function SheetFrame({
  open,
  onClose,
  title,
  onBack,
  footer,
  children,
  zClassName,
}: {
  open: boolean
  onClose: () => void
  title: string
  /** Adds a back chevron before the title (add flow, step 2). */
  onBack?: () => void
  footer?: ReactNode
  children: ReactNode
  /** Stacking class, to open one sheet over another. */
  zClassName?: string
}) {
  return (
    <ModalShell
      open={open}
      onBackdropClick={onClose}
      scrollChild
      zIndexClassName={zClassName}
      panelClassName="h-[calc(100dvh-48px)] max-h-[calc(100dvh-48px)] md:h-[min(46rem,calc(100dvh-4rem))] md:max-h-[calc(100dvh-4rem)] md:w-[min(28rem,calc(100vw-2rem))] md:rounded-3xl"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <Header title={title} onClose={onClose} onBack={onBack} />
        <div className="native-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4 pt-1 md:px-6 [&>*]:shrink-0">{children}</div>
        {footer ? (
          <div className="sheet-cta flex shrink-0 flex-col gap-2.5 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-5 pb-6 pt-3 md:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </ModalShell>
  )
}

/** Uppercase micro label above a block (Next charges, Matched charges...). */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className={microClassName}>{children}</h3>
}

/** The 12/600 field label used in the configure step. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{children}</span>
}
