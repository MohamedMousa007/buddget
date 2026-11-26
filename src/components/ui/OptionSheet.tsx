'use client'

import { useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PickerSheet } from '@/components/ui/PickerSheet'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export interface OptionSheetOption<T extends string> {
  value: T
  title: string
  subtitle?: string
  /** A glyph shown in a tinted tile before the title. */
  icon?: ReactNode
  /** The tile's colour (a CSS colour or variable); the tile is a light wash of it. Defaults to the brand teal. */
  tone?: string
}

interface BaseProps<T extends string> {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  options: readonly OptionSheetOption<T>[]
  zIndexClassName?: string
}

interface SingleProps<T extends string> extends BaseProps<T> {
  multiple?: false
  value: T | null
  /** Fired on tap; the sheet closes itself. */
  onChange: (value: T) => void
}

interface MultiProps<T extends string> extends BaseProps<T> {
  multiple: true
  value: readonly T[]
  /** Fired on Done with every ticked value. */
  onChange: (values: T[]) => void
}

export type OptionSheetProps<T extends string> = SingleProps<T> | MultiProps<T>

function Tick({ on, multi }: { on: boolean; multi: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-[22px] shrink-0 items-center justify-center border-2',
        multi ? 'rounded-[7px]' : 'rounded-full',
        on ? 'border-[var(--color-brand-primary)]' : 'border-[var(--color-brand-border-strong)]',
        on && multi && 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]',
      )}
    >
      {on ? multi ? <Check className="size-3.5" strokeWidth={3} /> : <span className="size-2.5 rounded-full bg-[var(--color-brand-primary)]" /> : null}
    </span>
  )
}

/**
 * Choose from a short list of rows (how often, what for, a category): an optional icon tile, a title and a line under
 * it. Single-select closes on tap; `multiple` ticks several and confirms with Done.
 */
export function OptionSheet<T extends string>(props: OptionSheetProps<T>) {
  const { open, onClose, title, subtitle, options, zIndexClassName } = props
  const t = useT()
  const initial = (): T[] => (props.multiple ? [...props.value] : [])
  const [picked, setPicked] = useState<T[]>(initial)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setPicked(initial())
  }

  const isOn = (v: T) => (props.multiple ? picked.includes(v) : props.value === v)
  const tap = (v: T) => {
    if (props.multiple) {
      setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))
      return
    }
    props.onChange(v)
    onClose()
  }

  return (
    <PickerSheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      zIndexClassName={zIndexClassName}
      footer={props.multiple ? <Button size="cta-block" onClick={() => { props.onChange(picked); onClose() }}>{t.common.done}</Button> : undefined}
    >
      <div
        role={props.multiple ? 'group' : 'radiogroup'}
        aria-label={title}
        className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]"
      >
        {options.map((o) => {
          const on = isOn(o.value)
          const tone = o.tone ?? 'var(--color-brand-primary)'
          return (
            <button
              key={o.value}
              type="button"
              role={props.multiple ? 'checkbox' : 'radio'}
              aria-checked={on}
              onClick={() => tap(o.value)}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-[var(--color-brand-elevated)]"
            >
              {o.icon ? (
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-[11px] [&_svg]:size-[18px]"
                  style={{ background: `color-mix(in oklab, ${tone} 14%, transparent)`, color: tone }}
                >
                  {o.icon}
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{o.title}</span>
                {o.subtitle ? <span className="block text-xs text-[var(--color-brand-text-secondary)]">{o.subtitle}</span> : null}
              </span>
              <Tick on={on} multi={!!props.multiple} />
            </button>
          )
        })}
      </div>
    </PickerSheet>
  )
}
