'use client'

import { Children, isValidElement, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { useModalTitleId } from '@/components/modals/ModalShell'
import { IconButton } from '@/components/ui/IconButton'

/**
 * `size="compact"` is the 20px title for sheets whose names are long or user-typed (a subscription, a goal): it wraps to
 * two lines at most, keeps the full name on the element, and follows the text's own direction. The default is unchanged.
 */
function Title({ children, size = 'default' }: { children: ReactNode; size?: 'default' | 'compact' }) {
  const id = useModalTitleId()
  if (size === 'compact') {
    return (
      <h2 id={id} dir="auto" title={typeof children === 'string' ? children : undefined} className="line-clamp-2 break-words text-[20px] font-bold leading-snug text-[var(--color-brand-text-primary)]">
        {children}
      </h2>
    )
  }
  return <h2 id={id} className="break-words text-[22px] font-bold text-[var(--color-brand-text-primary)]">{children}</h2>
}

function Subtitle({ children }: { children: ReactNode }) {
  return <p className="mt-0.5 text-sm text-[var(--color-brand-text-secondary)]">{children}</p>
}

/** Slot rendered next to the close button (e.g. a "Today" date chip). */
function Extra({ children }: { children: ReactNode }) {
  return <>{children}</>
}

interface V3HeaderProps {
  onClose: () => void
  children: ReactNode
  /** Control rendered before the title (e.g. a back button). */
  leading?: ReactNode
}

interface TitledHeaderProps {
  /** Shorthand for a sheet inside an already padded container: same look, no horizontal inset. */
  title: string
  subtitle?: ReactNode
  onClose: () => void
  /** Control rendered before the title (e.g. a back button). */
  leading?: ReactNode
}

export type SheetHeaderProps = V3HeaderProps | TitledHeaderProps

function Header({ onClose, children, leading, flush }: { onClose: () => void; children: ReactNode; leading?: ReactNode; flush?: boolean }) {
  const t = useT()
  const kids = Children.toArray(children)
  const extra = kids.find((c) => isValidElement(c) && c.type === Extra)
  const hasSubtitle = kids.some((c) => isValidElement(c) && c.type === Subtitle)
  const rest = kids.filter((c) => c !== extra)

  return (
    <div className={cn('flex justify-between gap-3 pb-2', hasSubtitle ? 'items-start' : 'items-center', !flush && 'px-5 pt-4', hasSubtitle && !flush && 'pb-1')}>
      {leading}
      <div className="min-w-0 flex-1">{rest}</div>
      <div className="flex shrink-0 items-center gap-2">
        {extra}
        <IconButton
          onClick={onClose}
          aria-label={t.common.close}
          variant="tinted"
          className="shrink-0"
        >
          <X size={18} />
        </IconButton>
      </div>
    </div>
  )
}

/** The one sheet header: compound `Title`/`Subtitle`/`Extra` children, or the `title` shorthand for padded containers. */
function V3SheetHeaderBase(props: SheetHeaderProps) {
  if ('title' in props) {
    return (
      <Header onClose={props.onClose} leading={props.leading} flush>
        <Title>{props.title}</Title>
        {props.subtitle ? <Subtitle>{props.subtitle}</Subtitle> : null}
      </Header>
    )
  }
  return <Header onClose={props.onClose} leading={props.leading}>{props.children}</Header>
}

export const V3SheetHeader = Object.assign(V3SheetHeaderBase, { Title, Subtitle, Extra })
