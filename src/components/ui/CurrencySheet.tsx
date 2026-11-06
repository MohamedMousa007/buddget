'use client'

import { useState } from 'react'
import { Ban, Check, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { CurrencyBadge, CurrencyList } from '@/components/ui/CurrencyList'
import { CurrencyMark } from '@/components/ui/CurrencyMark'
import { IconButton } from '@/components/ui/IconButton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { defaultSecondCurrency } from '@/hooks/useSettingToggle'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { tryConvertCurrency } from '@/lib/utils/currency'
import type { Currency } from '@/lib/store/types'
import { ModalTitle } from '@/components/modals/ModalTitle'

interface CurrencySingleProps {
  dual?: false
  open: boolean
  /** Currently selected ISO code. */
  value: string
  /** Fired on row tap; the caller sets state and closes. */
  onSelect: (code: string) => void
  onClose: () => void
  /** User's base currency, pinned first under Common. */
  base?: Currency
  /** Include gold (XAU), for debt currency pickers. */
  includeGold?: boolean
  /** Restrict the list to these codes (defaults to all fiat, +XAU when includeGold). */
  codes?: readonly string[]
  zIndexClassName?: string
}

function CurrencySingleBody({ open, value, onSelect, onClose, base, includeGold, codes, zIndexClassName }: Omit<CurrencySingleProps, 'dual'>) {
  const c = useT().inlineCopy.currencyPicker
  useEscapeClose(open, onClose)
  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName={zIndexClassName ?? 'z-[110]'} panelClassName="md:w-[440px]" padContent>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 items-center justify-between">
          <ModalTitle>{c.title}</ModalTitle>
          <IconButton onClick={onClose} aria-label={c.close} variant="tinted" size="sm" shape="round">
            <X className="h-full w-full" />
          </IconButton>
        </div>
        <CurrencyList value={value} onSelect={onSelect} base={base} includeGold={includeGold} codes={codes} />
      </div>
    </ModalShell>
  )
}

type Tab = 'main' | 'second'

interface CurrencyDualProps {
  /** Main + optional second currency in one sheet. */
  dual: true
  open: boolean
  onClose: () => void
  base: Currency
  /** The second currency, or null while it is switched off. */
  second: Currency | null
  rates: Record<string, number>
  onPickMain: (code: string) => void
  onPickSecond: (code: string | null) => void
  initialTab?: Tab
  /** Extra control under the list, e.g. a "show cents" switch. */
  footer?: React.ReactNode
}

const SAMPLE = 1250

const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2))

/**
 * The dual mode: both the main and the optional second currency: a Main / Second switch, the shared list,
 * an explicit Off choice for the second, and a preview of how an amount reads in the app with the current choice.
 */
function CurrencyDualBody({ open, onClose, base, second, rates, onPickMain, onPickSecond, initialTab = 'main', footer }: Omit<CurrencyDualProps, 'dual'>) {
  const c = useT().inlineCopy.currencyDual
  const [tab, setTab] = useState<Tab>(initialTab)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setTab(initialTab)
  }
  useEscapeClose(open, onClose)

  const sampleSecond = defaultSecondCurrency(base)
  const sampleConverted = tryConvertCurrency(SAMPLE, base, sampleSecond, rates)

  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName="z-[110]" panelClassName="md:w-[460px]" padContent>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 items-center justify-between">
          <ModalTitle>{c.title}</ModalTitle>
          <IconButton onClick={onClose} aria-label={c.close} variant="tinted" size="sm" shape="round">
            <X className="h-full w-full" />
          </IconButton>
        </div>

        <SegmentedControl<Tab>
          ariaLabel={c.tabs}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'main', label: `${c.main} · ${base}` },
            { value: 'second', label: `${c.second} · ${second ?? c.off}` },
          ]}
        />

        {tab === 'second' && second === null ? (
          <div className="shrink-0 space-y-2 rounded-2xl bg-[var(--color-brand-elevated)] px-4 py-3" aria-live="polite">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{c.previewTitle}</p>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-brand-card)] px-3 py-2">
              <span className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{c.sampleTxn}</span>
              <span className="text-end">
                <span className="font-mono-numbers block text-sm font-bold text-[var(--color-brand-text-primary)]"><CurrencyMark code={base} /> {fmt(SAMPLE)}</span>
                {sampleConverted !== null ? (
                  <span className="font-mono-numbers block text-xs text-[var(--color-brand-text-muted)]">≈ <CurrencyMark code={sampleSecond} /> {fmt(sampleConverted)}</span>
                ) : null}
              </span>
            </div>
            <p className="text-xs text-[var(--color-brand-text-muted)]">{c.previewOff}</p>
          </div>
        ) : null}

        {tab === 'main' ? (
          <CurrencyList key="main" value={base} base={base} onSelect={onPickMain} />
        ) : (
          <CurrencyList
            key="second"
            value={second}
            base={base}
            codes={FIAT_CURRENCIES.filter((x) => x !== base)}
            onSelect={onPickSecond}
            leading={
              <button
                type="button"
                onClick={() => onPickSecond(null)}
                aria-pressed={second === null}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-start transition-colors',
                  second === null ? 'bg-[var(--color-brand-primary-soft)]' : 'hover:bg-[var(--color-brand-elevated)]',
                )}
              >
                <CurrencyBadge code="" selected={second === null}><Ban className="size-5" aria-hidden /></CurrencyBadge>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{c.off}</span>
                  <span className="block truncate text-xs text-[var(--color-brand-text-muted)]">{c.offHint}</span>
                </span>
                {second === null ? <Check className="size-5 shrink-0 text-[var(--color-brand-primary-ink)]" aria-hidden /> : null}
              </button>
            }
          />
        )}
        {footer}
      </div>
    </ModalShell>
  )
}

export type CurrencySheetProps = CurrencySingleProps | CurrencyDualProps

/** The app's currency picker over CurrencyList. Single mode (default) picks one currency; `dual` picks the main and the optional second. */
export function CurrencySheet(props: CurrencySheetProps) {
  if (props.dual) {
    const { dual: _dual, ...rest } = props
    return <CurrencyDualBody {...rest} />
  }
  const { dual: _dual, ...rest } = props
  return <CurrencySingleBody {...rest} />
}
