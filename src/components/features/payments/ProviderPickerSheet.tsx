'use client'

import { useMemo, useState } from 'react'
import { X, Search, Check, Plus } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { useT } from '@/lib/i18n'
import { PAYMENT_BRANDS, PAYMENT_TYPE_META, brandIssuesType } from '@/lib/payment/paymentMethodDefaults'
import type { PaymentMethodType } from '@/lib/store/types'

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

/**
 * App-wide provider chooser over the {@link PAYMENT_BRANDS} catalogue — searchable, Popular/All
 * sections, custom-provider CTA. Filter to a single money-holding type with `issuesType`
 * (e.g. `bank_account` for a savings pocket hides wallets/rails). Shared by payment-method setup
 * and savings-pocket creation so there is ONE provider pool, not per-surface hardcoded lists.
 */
export interface ProviderPickerSheetProps {
  open: boolean
  selectedId: string | null
  popularIds: string[]
  onPick: (id: string) => void
  onCustom: (term: string) => void
  onClose: () => void
  /** Locked context: only show providers that issue this type. */
  issuesType?: PaymentMethodType
  zIndexClassName?: string
}

export function ProviderPickerSheet({
  open, selectedId, popularIds, onPick, onCustom, onClose, issuesType, zIndexClassName,
}: ProviderPickerSheetProps) {
  const t = useT()
  const [query, setQuery] = useState('')
  // Escape/back are handled by ModalShell's LIFO stack — no extra handler here (would double-peel).

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const ids = Object.keys(PAYMENT_BRANDS).filter(
      (id) => !issuesType || brandIssuesType(PAYMENT_BRANDS[id], issuesType),
    )
    if (q) {
      const hits = ids.filter((id) => (`${PAYMENT_BRANDS[id].name} ${PAYMENT_BRANDS[id].full ?? ''}`).toLowerCase().includes(q))
      return hits.map((id) => ({ kind: 'item' as const, id }))
    }
    const popular = popularIds.filter((id) => ids.includes(id))
    const rest = ids.filter((id) => !popular.includes(id))
    return [
      ...(popular.length
        ? [
            { kind: 'header' as const, label: t.paymentMethods.popularOptions },
            ...popular.map((id) => ({ kind: 'item' as const, id })),
          ]
        : []),
      { kind: 'header' as const, label: t.paymentMethods.allProviders },
      ...rest.map((id) => ({ kind: 'item' as const, id })),
    ]
  }, [query, popularIds, t, issuesType])

  const customLabel = query.trim()
    ? t.paymentMethods.addCustomNamed.replace('{q}', query.trim())
    : t.paymentMethods.addCustom

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild zIndexClassName={zIndexClassName} panelClassName="h-[64vh] lg:w-[420px]">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <div className="flex shrink-0 items-center justify-between pb-3 pt-1">
          <span className="text-lg font-semibold text-[var(--color-brand-text-primary)]">
            {t.paymentMethods.chooseProvider}
          </span>
          <button
            type="button" aria-label="Close" onClick={onClose}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--color-brand-elevated)] p-[9px] text-[var(--color-brand-text-muted)]"
          >
            <X className="h-full w-full" />
          </button>
        </div>
        <div className="relative mb-2.5 shrink-0">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-brand-text-muted)]" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t.paymentMethods.searchProviderPlaceholder}
            className="h-11 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] ps-10 pe-3 text-[15px] text-[var(--color-brand-text-primary)] text-start outline-none"
          />
        </div>
        <div className="native-scroll -mx-1 flex max-h-[52vh] min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
          {rows.map((r, i) => {
            if (r.kind === 'header') {
              return (
                <div key={`h-${r.label}-${i}`} className="px-1.5 pb-1 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-brand-text-muted)]">
                  {r.label}
                </div>
              )
            }
            const b = PAYMENT_BRANDS[r.id]
            const col = b.colors[0]
            const sel = selectedId === r.id
            return (
              <button
                key={`${r.id}-${i}`} type="button" onClick={() => onPick(r.id)}
                className="flex min-h-14 w-full items-center gap-3 rounded-[14px] border px-3 py-2 text-start"
                style={sel
                  ? { background: 'rgba(56,217,107,.12)', borderColor: 'rgba(56,217,107,.45)' }
                  : { borderColor: 'transparent' }}
              >
                <span
                  className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] text-[12px] font-extrabold"
                  style={{ background: rgba(col, 0.18), color: col }}
                >
                  {b.short}
                </span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block truncate text-[14.5px] font-semibold text-[var(--color-brand-text-primary)]">{b.name}</span>
                  <span className="block text-[11px] font-medium text-[var(--color-brand-text-muted)]">
                    {PAYMENT_TYPE_META[issuesType ?? b.type].label}{b.full ? ` · ${b.full}` : ''}
                  </span>
                </span>
                {sel && <Check className="h-[18px] w-[18px] shrink-0 text-[#38D96B]" />}
              </button>
            )
          })}
        </div>
        <button
          type="button" onClick={() => onCustom(query)}
          className="sheet-cta mt-2.5 flex h-[50px] w-full shrink-0 items-center justify-center gap-2 rounded-[13px] border border-[var(--color-brand-red)]/30 bg-[var(--color-brand-red)]/10 text-sm font-semibold text-[#FF5C5C]"
        >
          <Plus className="h-[18px] w-[18px]" />
          {customLabel}
        </button>
      </div>
    </ModalShell>
  )
}
