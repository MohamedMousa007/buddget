'use client'

import { useState } from 'react'
import { Ban, Check, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { CurrencyBadge, CurrencyList } from '@/components/ui/CurrencyList'
import { CurrencyMark } from '@/components/ui/CurrencyMark'
import { IconButton } from '@/components/ui/IconButton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import { useLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { tryConvertCurrency } from '@/lib/utils/currency'
import type { Currency } from '@/lib/store/types'

type Tab = 'main' | 'second'

interface CurrencyDualSheetProps {
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

const COPY = {
  en: {
    title: 'Currencies',
    main: 'Main',
    second: 'Second',
    off: 'Off',
    offHint: 'Amounts show in your main currency only',
    previewTitle: 'How it looks in the app',
    previewOff: 'Turn on a second currency to see amounts in both.',
    close: 'Close',
    tabs: 'Currency to change',
  },
  ar: {
    title: 'العملات',
    main: 'الأساسية',
    second: 'الثانية',
    off: 'إيقاف',
    offHint: 'تظهر المبالغ بالعملة الأساسية فقط',
    previewTitle: 'هكذا تظهر في التطبيق',
    previewOff: 'فعّل عملة ثانية لترى المبالغ بالعملتين.',
    close: 'إغلاق',
    tabs: 'العملة المراد تغييرها',
  },
}

const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2))

/**
 * One currency picker for both the main and the optional second currency: a Main / Second switch, the shared list,
 * an explicit Off choice for the second, and a preview of how an amount reads in the app with the current choice.
 */
export function CurrencyDualSheet({ open, onClose, base, second, rates, onPickMain, onPickSecond, initialTab = 'main', footer }: CurrencyDualSheetProps) {
  const { locale } = useLocale()
  const c = COPY[locale]
  const [tab, setTab] = useState<Tab>(initialTab)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setTab(initialTab)
  }
  useEscapeClose(open, onClose)

  const converted = second ? tryConvertCurrency(SAMPLE, base, second, rates) : null

  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName="z-[110]" panelClassName="md:w-[460px]" padContent>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{c.title}</h2>
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

        <div className="shrink-0 rounded-2xl bg-[var(--color-brand-elevated)] px-4 py-3" aria-live="polite">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{c.previewTitle}</p>
          <p className="font-mono-numbers mt-1 flex items-baseline gap-1.5 text-2xl font-bold text-[var(--color-brand-text-primary)]">
            <span className="text-lg text-[var(--color-brand-text-secondary)]"><CurrencyMark code={base} /></span>
            {fmt(SAMPLE)}
          </p>
          {second && converted !== null ? (
            <p className="font-mono-numbers mt-0.5 flex items-baseline gap-1 text-sm font-semibold text-[var(--color-brand-text-muted)]">
              ≈ <CurrencyMark code={second} /> {fmt(converted)}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">{second ? c.offHint : c.previewOff}</p>
          )}
        </div>

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
                  <span className="block text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{c.off}</span>
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
