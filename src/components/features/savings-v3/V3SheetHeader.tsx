'use client'

import { Children, isValidElement, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useModalTitleId } from '@/components/modals/ModalShell'
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

interface V3SheetHeaderProps {
  onClose: () => void
  children: ReactNode
}

function V3SheetHeaderBase({ onClose, children }: V3SheetHeaderProps) {
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

export const V3SheetHeader = Object.assign(V3SheetHeaderBase, { Title, Subtitle, Extra })
