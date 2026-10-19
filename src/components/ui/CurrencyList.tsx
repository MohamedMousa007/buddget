'use client'

import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { CurrencyMark } from '@/components/ui/CurrencyMark'
import { Input } from '@/components/ui/input'
import { CURRENCY_META, COMMON_CURRENCIES } from '@/lib/constants/currencyMeta'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import { useLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { Currency } from '@/lib/store/types'

/** A round badge carrying the currency's sign; fills with brand teal when `selected`. */
export function CurrencyBadge({ code, selected = false, className, children }: { code: string; selected?: boolean; className?: string; children?: React.ReactNode }) {
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold leading-none',
        selected ? 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]' : 'bg-[var(--color-brand-sunken)] text-[var(--color-brand-text-secondary)]',
        className,
      )}
    >
      {children ?? <CurrencyMark code={code} />}
    </span>
  )
}

export function useCurrencyName() {
  const { locale } = useLocale()
  return (code: string) => (locale === 'ar' ? CURRENCY_META[code]?.nameAr : undefined) ?? CURRENCY_META[code]?.name ?? code
}

interface CurrencyListProps {
  value: string | null
  onSelect: (code: string) => void
  base?: Currency
  includeGold?: boolean
  codes?: readonly string[]
  /** Rendered above the pinned currencies, e.g. a "None" choice. */
  leading?: React.ReactNode
  autoFocus?: boolean
}

/** Search, a pinned grid of common currencies, then everything A to Z. Shared by every currency picker. */
export function CurrencyList({ value, onSelect, base, includeGold = false, codes, leading, autoFocus = false }: CurrencyListProps) {
  const { locale } = useLocale()
  const nameOf = useCurrencyName()
  const [query, setQuery] = useState('')

  const all = useMemo<string[]>(() => {
    if (codes) return [...codes]
    return includeGold ? [...FIAT_CURRENCIES, 'XAU'] : [...FIAT_CURRENCIES]
  }, [codes, includeGold])

  const q = query.trim().toLowerCase()
  const hits = useMemo(
    () => (q ? all.filter((c) => c.toLowerCase().includes(q) || nameOf(c).toLowerCase().includes(q) || (CURRENCY_META[c]?.name ?? '').toLowerCase().includes(q)) : []),
    [all, q, nameOf],
  )
  const common = useMemo(() => {
    const list: string[] = []
    if (base && all.includes(base)) list.push(base)
    for (const c of COMMON_CURRENCIES) if (all.includes(c) && !list.includes(c)) list.push(c)
    return list.slice(0, 6)
  }, [all, base])
  const rest = useMemo(() => all.filter((c) => !common.includes(c)).sort(), [all, common])

  const row = (code: string) => {
    const selected = code === value
    return (
      <button
        key={code}
        type="button"
        onClick={() => onSelect(code)}
        aria-pressed={selected}
        className={cn(
          'flex min-h-14 w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-start transition-colors',
          selected ? 'bg-[var(--color-brand-primary-soft)]' : 'hover:bg-[var(--color-brand-elevated)]',
        )}
      >
        <CurrencyBadge code={code} selected={selected} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{nameOf(code)}</span>
          <span className="font-mono-numbers block text-xs font-medium text-[var(--color-brand-text-muted)]">{code}</span>
        </span>
        {selected ? <Check className="size-5 shrink-0 text-[var(--color-brand-primary-ink)]" aria-hidden /> : null}
      </button>
    )
  }

  const caption = 'px-1 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute start-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[var(--color-brand-text-muted)]" aria-hidden />
        <Input
          size="brand"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={locale === 'ar' ? 'ابحث عن عملة أو دولة' : 'Search currency or country'}
          aria-label={locale === 'ar' ? 'بحث عن عملة' : 'Search currency'}
          autoFocus={autoFocus}
          className="ps-10"
        />
      </div>
      <div className="native-scroll -mx-1 max-h-[min(44dvh,400px)] overflow-y-auto px-1 pb-1">
        {q ? (
          hits.length ? (
            hits.map(row)
          ) : (
            <p className="px-3 py-8 text-center text-sm font-medium text-[var(--color-brand-text-muted)]">
              {locale === 'ar' ? `لا توجد عملة تطابق “${query.trim()}”` : `No currency matches “${query.trim()}”`}
            </p>
          )
        ) : (
          <>
            {leading}
            <p className={caption}>{locale === 'ar' ? 'الأكثر استخدامًا' : 'Common'}</p>
            <div className="grid grid-cols-3 gap-2">
              {common.map((code) => {
                const selected = code === value
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onSelect(code)}
                    aria-pressed={selected}
                    aria-label={`${nameOf(code)} ${code}`}
                    className={cn(
                      'flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5 transition-colors',
                      selected
                        ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)]'
                        : 'border-[var(--color-brand-border)] hover:bg-[var(--color-brand-elevated)]',
                    )}
                  >
                    <CurrencyBadge code={code} selected={selected} className="size-9" />
                    <span className="font-mono-numbers text-xs font-bold text-[var(--color-brand-text-primary)]">{code}</span>
                  </button>
                )
              })}
            </div>
            {rest.length ? <p className={caption}>{locale === 'ar' ? 'كل العملات' : 'All currencies'}</p> : null}
            {rest.map(row)}
          </>
        )}
      </div>
    </div>
  )
}
