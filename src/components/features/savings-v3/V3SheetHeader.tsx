'use client'

import { Children, isValidElement, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useModalTitleId } from '@/components/modals/ModalShell'
import { ModalTitle } from '@/components/modals/ModalTitle'
import { IconButton } from '@/components/ui/IconButton'

function Title({ children }: { children: ReactNode }) {
  return <h2 id={useModalTitleId()} className="text-[22px] font-bold text-[var(--color-brand-text-primary)]">{children}</h2>
}

function Subtitle({ children }: { children: ReactNode }) {
  return <p className="mt-0.5 text-sm text-[var(--color-brand-text-secondary)]">{children}</p>
}

/** Slot rendered next to the close button (e.g. a "Today" date chip). */
function Extra({ children }: { children: ReactNode }) {
  return <>{children}</>
}

interface V3HeaderProps {
  variant?: 'v3'
  onClose: () => void
  children: ReactNode
}

interface ModalHeaderProps {
  /** The legacy modal look: 16px semibold h3 with a plain X. */
  variant: 'modal'
  title: string
  onClose: () => void
  /** Margin below the title row. */
  titleRowClassName?: string
}

interface BarHeaderProps {
  /** The settings-hub look: truncating 18px bold h2, round tinted X, optional leading control. */
  variant: 'bar'
  title: string
  onClose: () => void
  leading?: ReactNode
}

export type SheetHeaderProps = V3HeaderProps | ModalHeaderProps | BarHeaderProps

function V3Header({ onClose, children }: Omit<V3HeaderProps, 'variant'>) {
  const kids = Children.toArray(children)
  const extra = kids.find((c) => isValidElement(c) && c.type === Extra)
  const hasSubtitle = kids.some((c) => isValidElement(c) && c.type === Subtitle)
  const rest = kids.filter((c) => c !== extra)

  return (
    <div className={`flex ${hasSubtitle ? 'items-start' : 'items-center'} justify-between gap-3 px-5 pt-4 ${hasSubtitle ? 'pb-1' : 'pb-2'}`}>
      <div className="min-w-0 flex-1">{rest}</div>
      <div className="flex shrink-0 items-center gap-2">
        {extra}
        <IconButton
          onClick={onClose}
          aria-label="Close"
          variant="tinted"
          className="shrink-0"
        >
          <X size={18} />
        </IconButton>
      </div>
    </div>
  )
}

function ModalHeader({ title, onClose, titleRowClassName = 'mb-4' }: Omit<ModalHeaderProps, 'variant'>) {
  const t = useT()
  return (
    <div className={cn('flex items-center justify-between shadow-none', titleRowClassName)}>
      <h3 id={useModalTitleId()} className="text-base font-semibold text-[var(--color-brand-text-primary)]">{title}</h3>
      <IconButton onClick={onClose} aria-label={t.common.close}>
        <X className="w-5 h-5 text-[var(--color-brand-text-muted)]" aria-hidden />
      </IconButton>
    </div>
  )
}

function BarHeader({ title, onClose, leading }: Omit<BarHeaderProps, 'variant'>) {
  const copy = useSettingsHubCopy()
  return (
    <div className="flex items-center justify-between gap-2">
      {leading}
      <ModalTitle className="min-w-0 flex-1 truncate text-lg font-bold text-[var(--color-brand-text-primary)]">{title}</ModalTitle>
      <IconButton onClick={onClose} aria-label={copy.close} variant="tinted" size="sm" shape="round"><X className="h-full w-full" /></IconButton>
    </div>
  )
}

/** The one sheet header. `v3` (default, compound Title/Subtitle/Extra) is the target look; `modal` and `bar` keep the legacy looks until step 2. */
function V3SheetHeaderBase(props: SheetHeaderProps) {
  if (props.variant === 'modal') return <ModalHeader title={props.title} onClose={props.onClose} titleRowClassName={props.titleRowClassName} />
  if (props.variant === 'bar') return <BarHeader title={props.title} onClose={props.onClose} leading={props.leading} />
  return <V3Header onClose={props.onClose}>{props.children}</V3Header>
}

export const V3SheetHeader = Object.assign(V3SheetHeaderBase, { Title, Subtitle, Extra })
