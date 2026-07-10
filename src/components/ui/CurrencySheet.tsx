'use client'

import { useMemo, useState } from 'react'
import { Search, Check, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import { CURRENCY_META, COMMON_CURRENCIES } from '@/lib/constants/currencyMeta'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { cn } from '@/lib/utils'
import type { Currency } from '@/lib/store/types'

interface CurrencySheetProps {
  open: boolean
  /** Currently selected ISO code (red-tint row + check). */
  value: string
  /** Fired on row tap; the caller sets state and closes. */
  onSelect: (code: string) => void
  onClose: () => void
  /** User's base currency — pinned first under Common. */
  base?: Currency
  /** Include gold (XAU) — for debt currency pickers. */
  includeGold?: boolean
  /** Restrict the list to these codes (defaults to all fiat, +XAU when includeGold). */
  codes?: readonly string[]
  zIndexClassName?: string
}

/**
 * Unified currency picker (handoff §4). Compact bottom sheet — flag + ISO code +
 * full name, searchable by code or name, Common pinned then all A→Z. Reused for
 * every currency selection across the app.
 */
export function CurrencySheet({
  open,
  value,
  onSelect,
  onClose,
  base,
  includeGold = false,
  codes,
  zIndexClassName,
}: CurrencySheetProps) {
  const [query, setQuery] = useState('')
  useEscapeClose(open, onClose)

  const allCodes = useMemo<string[]>(() => {
    if (codes) return [...codes]
    const list: string[] = [...FIAT_CURRENCIES]
    if (includeGold) list.push('XAU')
    return list
  }, [codes, includeGold])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      const hits = allCodes.filter(
        (c) =>
          c.toLowerCase().includes(q) ||
          (CURRENCY_META[c]?.name ?? '').toLowerCase().includes(q),
      )
      return hits.length
        ? hits.map((c) => ({ type: 'item' as const, code: c }))
        : [{ type: 'empty' as const }]
    }
    const common: string[] = []
    if (base && allCodes.includes(base)) common.push(base)
    for (const c of COMMON_CURRENCIES) if (allCodes.includes(c) && !common.includes(c)) common.push(c)
    const rest = allCodes.filter((c) => !common.includes(c)).sort()
    return [
      { type: 'header' as const, label: 'Common' },
      ...common.map((c) => ({ type: 'item' as const, code: c })),
      { type: 'header' as const, label: 'All currencies' },
      ...rest.map((c) => ({ type: 'item' as const, code: c })),
    ]
  }, [query, allCodes, base])

  return (
    <ModalShell
      open={open}
      onBackdropClick={onClose}
      zIndexClassName={zIndexClassName ?? 'z-[110]'}
      panelClassName="lg:w-[420px]"
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-3">
        <div className="flex shrink-0 items-center justify-between px-1 pb-2">
          <span className="text-[17px] font-semibold text-[var(--color-brand-text-primary)]">
            Currency
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--color-brand-elevated)] p-2 text-[var(--color-brand-text-muted)]"
          >
            <X className="h-full w-full" />
          </button>
        </div>
        <div className="relative mx-0.5 mb-2 shrink-0">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-brand-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search currency or country…"
            className="h-10 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] ps-9 pe-3 text-sm text-[var(--color-brand-text-primary)] text-start outline-none"
          />
        </div>
        <div className="native-scroll -mx-1 flex max-h-[42vh] flex-1 flex-col gap-0.5 overflow-y-auto px-1">
          {rows.map((r, i) => {
            if (r.type === 'header') {
              return (
                <div
                  key={`h-${r.label}`}
                  className="px-1.5 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-brand-text-muted)]"
                >
                  {r.label}
                </div>
              )
            }
            if (r.type === 'empty') {
              return (
                <div
                  key="empty"
                  className="px-3 py-7 text-center text-[13px] font-medium text-[var(--color-brand-text-muted)]"
                >
                  No currency matches “{query.trim()}”
                </div>
              )
            }
            const meta = CURRENCY_META[r.code]
            const selected = r.code === value
            return (
              <button
                key={`${r.code}-${i}`}
                type="button"
                onClick={() => onSelect(r.code)}
                className={cn(
                  'flex min-h-10 w-full items-center gap-3 rounded-[10px] px-2.5 py-1 text-start',
                  selected
                    ? 'border border-[var(--color-brand-red)]/45 bg-[var(--color-brand-red)]/10'
                    : 'border border-transparent',
                )}
              >
                <span className="w-[26px] shrink-0 text-center text-lg leading-none">
                  {meta?.flag ?? '🏳️'}
                </span>
                <span className="w-11 shrink-0 text-start font-mono-numbers text-sm font-bold text-[var(--color-brand-text-primary)]">
                  {r.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-[var(--color-brand-text-muted)]">
                  {meta?.name ?? r.code}
                </span>
                {selected && <Check className="h-[18px] w-[18px] shrink-0 text-[var(--color-brand-red)]" />}
              </button>
            )
          })}
        </div>
      </div>
    </ModalShell>
  )
}
