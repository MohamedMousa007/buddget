'use client'

import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * `children` and `value` are both removed from the DOM props: the button renders its
 * own label row, and the native `value` attribute is `string | number`, which would
 * collapse this interface to `never` if merged with a ReactNode `value`.
 */
export interface FieldButtonProps
  extends Omit<React.ComponentProps<'button'>, 'children' | 'value'> {
  /** The chosen value. Falls back to {@link placeholder} styling when empty. */
  value?: React.ReactNode
  /** Shown in muted text when there is no value yet. */
  placeholder?: string
  /** Rendered before the value — a category icon, a card brand, a flag. */
  icon?: React.ReactNode
  /** Replace the trailing chevron, or pass `null` to drop it. */
  affordance?: React.ReactNode
  /** 48px by default, matching `Input size="brand"`. `lg` is 52px for a two-line value. */
  size?: 'default' | 'lg'
  /** Marks the control invalid, matching the input's error treatment. */
  invalid?: boolean
  /**
   * Classes for the value itself, for a field whose value is not ordinary body
   * text — an amount rendered large and monospaced, for instance.
   */
  valueClassName?: string
}

/**
 * A button that has to sit in a form and look like the inputs around it — the
 * category picker, the payment-method picker, the date trigger.
 *
 * It exists because these are *buttons* semantically (they open a sheet) but must
 * be *fields* visually, and every form re-derived that from scratch at a slightly
 * different height. Its height and radius track `Input size="brand"`, so a field
 * and a field-shaped trigger line up in the same column without hand-tuning.
 *
 * The placeholder is styled but never announced as a value — an empty control reads
 * as empty, so pair it with a `<Label>` the way you would an input.
 *
 * ```tsx
 * <FieldButton value={cat?.label} placeholder={t.expenses.pickCategory}
 *              icon={<CategoryIcon id={cat?.id} />} onClick={open} />
 * ```
 */
export function FieldButton({
  className,
  value,
  placeholder,
  icon,
  affordance,
  size = 'default',
  invalid,
  valueClassName,
  type = 'button',
  ...props
}: FieldButtonProps) {
  const empty = value === undefined || value === null || value === ''

  return (
    <button
      data-slot="field-button"
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl border bg-[var(--color-brand-card)] px-3.5 text-start text-[15px] transition-colors outline-none',
        'focus-visible:ring-3 focus-visible:ring-[var(--color-brand-focus)]/50 focus-visible:border-[var(--color-brand-focus)]',
        'disabled:pointer-events-none disabled:opacity-50',
        size === 'lg' ? 'h-[52px]' : 'h-12',
        invalid
          ? 'border-[var(--color-brand-red)]'
          : 'border-[var(--color-brand-border)] hover:bg-[var(--color-brand-elevated)]',
        className
      )}
      {...props}
    >
      {icon ? <span className="flex shrink-0 items-center">{icon}</span> : null}
      <span
        className={cn(
          'min-w-0 flex-1 truncate font-medium',
          empty
            ? 'text-[var(--color-brand-text-muted)]'
            : 'text-[var(--color-brand-text-primary)]',
          valueClassName
        )}
      >
        {empty ? placeholder : value}
      </span>
      {affordance === undefined ? (
        <ChevronDown className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" />
      ) : (
        affordance
      )}
    </button>
  )
}
