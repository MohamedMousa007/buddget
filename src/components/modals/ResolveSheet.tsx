'use client'

import { useState, type ReactNode } from 'react'
import { Check, Lock } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SheetBody, SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SelectableCard, selectableCardVariants } from '@/components/ui/SelectableCard'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { cn } from '@/lib/utils'

export interface ResolveAction {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}

interface ResolveSheetProps {
  open: boolean
  onClose: () => void
  title: string
  /** One line saying what happens. */
  subtitle?: ReactNode
  /** A quiet text action under the title ("Select all ready"). */
  headerAction?: ResolveAction
  /** One answer for every row (an account picker), shown above the footer. */
  field?: ReactNode
  /** Why the primary action is unavailable, or what failed; announced politely. */
  note?: { text: string; tone: 'error' | 'warning' }
  /** `success` is reserved for confirming money that came in. */
  primary: ResolveAction & { variant?: 'default' | 'success' }
  /** Optional: the quiet other answer ("Not interested"), labelled by the consumer. */
  secondary?: ResolveAction
  /** While true the sheet cannot be closed (a request is in flight). */
  busy?: boolean
  /** `ResolveRow`s and `ResolveGroupLabel`s. */
  children: ReactNode
}

/**
 * The shell for "here is a list, resolve it": header with one line saying what happens, the rows, and a pinned footer
 * with the primary answer and an optional quiet secondary. Each job keeps its own decision logic and passes rows in;
 * this component owns only the frame, so the four resolve sheets cannot drift apart again.
 */
export function ResolveSheet({ open, onClose, title, subtitle, headerAction, field, note, primary, secondary, busy, children }: ResolveSheetProps) {
  const close = busy ? () => {} : onClose
  return (
    <ModalShell open={open} onBackdropClick={close} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={close}>
          <V3SheetHeader.Title>{title}</V3SheetHeader.Title>
          {subtitle ? <V3SheetHeader.Subtitle>{subtitle}</V3SheetHeader.Subtitle> : null}
        </V3SheetHeader>
        {headerAction ? (
          <div className="px-5">
            <Button variant="link" size="touch" className="-ms-2.5 px-2.5 font-semibold" disabled={headerAction.disabled} onClick={headerAction.onPress}>
              {headerAction.label}
            </Button>
          </div>
        ) : null}
        <SheetBody className="pt-1">
          <div role="group" aria-label={title} className="flex flex-col gap-2">
            {children}
          </div>
        </SheetBody>
        <SheetFooter safeArea>
          {field ? <div className="mb-2">{field}</div> : null}
          {note ? (
            <p role="status" className={cn('mb-2 text-xs leading-snug', note.tone === 'error' ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-amber)]')}>
              {note.text}
            </p>
          ) : null}
          <Button size="cta-block" variant={primary.variant ?? 'default'} loading={primary.loading} disabled={primary.disabled} onClick={primary.onPress} className="font-semibold">
            {primary.label}
          </Button>
          {secondary ? (
            <Button size="touch" variant="ghost" className="mt-1 w-full font-semibold text-[var(--color-brand-text-secondary)]" disabled={secondary.disabled || busy} onClick={secondary.onPress}>
              {secondary.label}
            </Button>
          ) : null}
        </SheetFooter>
      </div>
    </ModalShell>
  )
}

/** The leading tile of a row with no brand of its own: the first letter on a soft fill (green for money in). */
export function ResolveTile({ label, moneyIn }: { label: string; moneyIn?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-[10px] text-sm font-bold',
        moneyIn ? 'bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]' : 'bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)]',
      )}
    >
      {Array.from(label.trim())[0]?.toUpperCase() ?? '•'}
    </span>
  )
}

/** A 10px uppercase label over a run of rows ("Ready · 47"). */
export function ResolveGroupLabel({ children }: { children: ReactNode }) {
  return <h3 className={cn(microClassName, 'mt-1')}>{children}</h3>
}

export interface ResolveRowProps {
  leading: ReactNode
  title: string
  sub?: string
  /** An amount or a state word on the right. */
  trailing?: ReactNode
  /** Amber = needs a choice, green = money in, red = a problem, teal = a fact about the row. */
  chip?: { tone: 'warn' | 'positive' | 'negative' | 'brand'; text: string }
  /**
   * `idle`/`selected`/`failed` toggle with `onToggle`; `locked` cannot be selected (the reason is the chip);
   * `plain` is a row with nothing to choose.
   */
  state: 'idle' | 'selected' | 'failed' | 'locked' | 'plain'
  onToggle?: () => void
  /** Evidence that sits one tap away (the original message). */
  detail?: ReactNode
  detailLabels?: { show: string; hide: string }
  detailDefaultOpen?: boolean
  /** The full spoken label: merchant, amount, date and chip. */
  label?: string
}

/** One selectable row of a resolve sheet. Selection is announced as a checkbox, never left to colour. */
export function ResolveRow({ leading, title, sub, trailing, chip, state, onToggle, detail, detailLabels, detailDefaultOpen, label }: ResolveRowProps) {
  const [open, setOpen] = useState(Boolean(detailDefaultOpen))
  const selectable = state === 'idle' || state === 'selected' || state === 'failed'
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{title}</span>
        {sub ? <span className="block text-xs text-[var(--color-brand-text-secondary)]">{sub}</span> : null}
        {chip ? (
          <Badge tone={chip.tone} size="xs" bordered={false} className="mt-1 max-w-full whitespace-normal">
            {chip.text}
          </Badge>
        ) : null}
      </span>
      {trailing ? <span className="font-mono-numbers text-sm font-semibold">{trailing}</span> : null}
      {state === 'selected' || state === 'failed' ? (
        <Check className="size-4 shrink-0 text-[var(--color-brand-primary-ink)]" aria-hidden />
      ) : state === 'idle' ? (
        <span className="size-4 shrink-0 rounded-full border border-[var(--color-brand-text-secondary)]" aria-hidden />
      ) : state === 'locked' ? (
        <Lock className="size-4 shrink-0 text-[var(--color-brand-text-secondary)]" aria-hidden />
      ) : null}
    </>
  )
  return (
    <div>
      {selectable ? (
        <SelectableCard
          as="checkbox"
          layout="row"
          selected={state !== 'idle'}
          aria-label={label}
          onClick={onToggle}
          className={cn('h-auto min-h-[56px] py-2.5', state === 'failed' && 'border-[var(--color-brand-red)]')}
        >
          {body}
        </SelectableCard>
      ) : (
        <div aria-label={label} className={cn(selectableCardVariants({ layout: 'row', selected: false }), 'h-auto min-h-[56px] py-2.5', state === 'locked' && 'bg-[var(--color-brand-sunken)]')}>
          {body}
        </div>
      )}
      {detail && detailLabels ? (
        <div className="px-1">
          <Button variant="link" size="touch" className="px-2 text-xs font-semibold" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? detailLabels.hide : detailLabels.show}
          </Button>
          {open ? <div className="pb-2">{detail}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
