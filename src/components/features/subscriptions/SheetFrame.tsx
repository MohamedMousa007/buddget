'use client'

import { ChevronLeft, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalTitle } from '@/components/modals/ModalTitle'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { IconButton } from '@/components/ui/IconButton'
import { useT } from '@/lib/i18n'

function Header({ title, onClose, onBack }: { title: string; onClose: () => void; onBack?: () => void }) {
  const t = useT()
  return (
    <div className="flex min-h-12 shrink-0 items-center gap-2 ps-5 pe-3 md:ps-6">
      {onBack ? (
        <IconButton aria-label={t.common.back} onClick={onBack} className="-ms-3">
          <ChevronLeft strokeWidth={1.75} className="text-[var(--color-brand-text-secondary)] rtl:rotate-180" />
        </IconButton>
      ) : null}
      <ModalTitle className="min-w-0 flex-1 truncate">{title}</ModalTitle>
      <IconButton aria-label={t.common.close} onClick={onClose}>
        <X strokeWidth={1.75} className="text-[var(--color-brand-text-secondary)]" />
      </IconButton>
    </div>
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
}: {
  open: boolean
  onClose: () => void
  title: string
  /** Adds a back chevron before the title (add flow, step 2). */
  onBack?: () => void
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <ModalShell
      open={open}
      onBackdropClick={onClose}
      scrollChild
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
