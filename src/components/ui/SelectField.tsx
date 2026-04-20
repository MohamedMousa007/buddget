'use client'

import { forwardRef, useMemo } from 'react'
import { Combobox } from '@base-ui/react/combobox'
import { ChevronDown, Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

export interface SelectFieldOption {
  value: string
  label: string
  /** Optional leading glyph (emoji, symbol, or lucide icon). */
  glyph?: React.ReactNode
  /** Optional secondary line under the label. */
  description?: string
  disabled?: boolean
}

export interface SelectFieldProps {
  /** The currently selected value (stringified — callers cast back on change). */
  value: string
  onChange: (next: string) => void
  items: ReadonlyArray<SelectFieldOption>
  /** Shown in the trigger when no option is selected. Optional — most call
   *  sites require a value so the trigger always renders the selected label. */
  placeholder?: string
  /**
   * Force-enable or disable the search input. If omitted, auto-enables when
   * the list has more than 8 items — small lists don't benefit from search
   * and a typeahead is faster.
   */
  searchable?: boolean
  disabled?: boolean
  /** Custom content inside the trigger — overrides the default selected-label
   *  render when you need a glyph prefix or a currency symbol. */
  renderTrigger?: (selected: SelectFieldOption | null) => React.ReactNode
  /** Extra classes for the trigger button (e.g., width, padding tweaks). */
  className?: string
  /** Forwarded to the native trigger for accessibility tools. */
  'aria-label'?: string
  id?: string
  name?: string
}

/**
 * Themed single-select field. Delegates to Base UI's `Combobox` under the
 * hood so search / keyboard nav / portal rendering / focus return all come
 * for free. Renders as a floating popover on `sm+` and as a bottom sheet on
 * small screens (by virtue of `max-h: 70svh` + flex layout; Base UI's
 * positioner collision logic handles placement).
 *
 * The API is intentionally narrow — `items`-array with `{ value, label }` —
 * so every call site across the app uses the same shape. Call sites that
 * need richer visuals pass `renderTrigger` or add `glyph`/`description` to
 * their items.
 */
export const SelectField = forwardRef<HTMLButtonElement, SelectFieldProps>(
  function SelectField(
    {
      value,
      onChange,
      items,
      placeholder,
      searchable,
      disabled,
      renderTrigger,
      className,
      id,
      name,
      'aria-label': ariaLabel,
    },
    ref,
  ) {
    const t = useT()
    const showSearch = searchable ?? items.length > 8
    const selected = useMemo(() => items.find((i) => i.value === value) ?? null, [items, value])

    return (
      <Combobox.Root
        name={name}
        items={items as unknown as Array<{ value: string; label: string }>}
        itemToStringLabel={(item) => (item as SelectFieldOption).label}
        itemToStringValue={(item) => (item as SelectFieldOption).value}
        value={selected as unknown as Record<string, unknown>}
        onValueChange={(next) => {
          const picked = next as unknown as SelectFieldOption | null
          if (picked && !picked.disabled) onChange(picked.value)
        }}
        disabled={disabled}
      >
        <Combobox.Trigger
          ref={ref}
          id={id}
          aria-label={ariaLabel}
          className={cn(
            'group flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors',
            'bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]',
            'hover:border-[var(--color-brand-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-red)]',
            'data-[popup-open]:border-[var(--color-brand-red)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-start">
            {renderTrigger ? (
              renderTrigger(selected)
            ) : selected ? (
              <>
                {selected.glyph ? <span className="shrink-0">{selected.glyph}</span> : null}
                <span className="truncate">{selected.label}</span>
              </>
            ) : (
              <span className="text-[var(--color-brand-text-muted)]">
                {placeholder ?? t.ui.select.placeholder}
              </span>
            )}
          </span>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-[var(--color-brand-text-muted)] transition-transform group-data-[popup-open]:rotate-180"
            aria-hidden
          />
        </Combobox.Trigger>

        <Combobox.Portal>
          <Combobox.Positioner
            sideOffset={6}
            className="z-[60] outline-none"
            align="start"
          >
            <Combobox.Popup
              className={cn(
                'w-[var(--anchor-width)] min-w-[14rem] max-w-[min(92vw,28rem)] overflow-hidden rounded-2xl border shadow-2xl',
                'bg-[var(--color-brand-card)] border-[var(--color-brand-border)]',
                'data-[open]:animate-in data-[closed]:animate-out',
                'data-[open]:fade-in-0 data-[closed]:fade-out-0',
                'data-[open]:zoom-in-95 data-[closed]:zoom-out-95',
              )}
            >
              {showSearch ? (
                <div className="relative border-b border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
                  <Search
                    className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-brand-text-muted)]"
                    aria-hidden
                  />
                  <Combobox.Input
                    placeholder={t.ui.select.search}
                    className={cn(
                      'w-full bg-transparent py-2.5 ps-9 pe-3 text-sm text-[var(--color-brand-text-primary)] outline-none',
                      'placeholder:text-[var(--color-brand-text-muted)]',
                    )}
                  />
                </div>
              ) : null}

              {/* Base UI keeps the Empty wrapper mounted for a11y live-region
                  announcements — its children are null when the list has
                  items but the div itself still reserves vertical space
                  from its padding. `empty:hidden` collapses it back out
                  whenever there is no text content inside. */}
              <Combobox.Empty className="empty:hidden px-3 py-6 text-center text-xs text-[var(--color-brand-text-muted)]">
                {t.ui.select.empty}
              </Combobox.Empty>
              {/*
                Render items via a List render-function, NOT a plain `.map()`.
                Base UI filters `Combobox.Root`'s `items` on every input
                change and only the function-child rendering path receives
                the filtered subset — a manual `items.map()` would bypass
                the filter and the list would stay static as the user types.
              */}
              <Combobox.List className="max-h-[min(70svh,22rem)] overflow-y-auto p-1">
                {(opt: SelectFieldOption) => (
                  <Combobox.Item
                    key={opt.value}
                    value={opt as unknown as never}
                    disabled={opt.disabled}
                    className={cn(
                      'group/item relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none',
                      'text-[var(--color-brand-text-primary)]',
                      'data-[highlighted]:bg-[var(--color-brand-elevated)]',
                      'data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed',
                    )}
                  >
                    {opt.glyph ? <span className="shrink-0">{opt.glyph}</span> : null}
                    <span className="min-w-0 flex-1 truncate">
                      <span className="block truncate">{opt.label}</span>
                      {opt.description ? (
                        <span className="block truncate text-[11px] text-[var(--color-brand-text-muted)]">
                          {opt.description}
                        </span>
                      ) : null}
                    </span>
                    <Combobox.ItemIndicator className="shrink-0 text-[var(--color-brand-red)]">
                      <Check className="h-4 w-4" aria-hidden />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    )
  },
)
