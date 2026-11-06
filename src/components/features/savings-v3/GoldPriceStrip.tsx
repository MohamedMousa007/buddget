'use client'

import { ChevronDown, ChevronUp, RefreshCw, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { IconButton } from '@/components/ui/IconButton'
import { useAssetPrices } from '@/hooks/useAssetPrices'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useLocale, useT } from '@/lib/i18n'
import { formatClock, formatLocalized } from '@/lib/i18n/dateFormat'
import { egyptKaratPrice, usdPerGram } from '@/lib/prices/egyptGold'
import { formatWhole } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'

type Freshness = 'fresh' | 'stale' | 'unavailable'

const KARATS = [24, 21, 18] as const
const DAY_MS = 86_400_000

/**
 * Egypt's gold prices in one bar, and the page's freshness status. The world row carries the
 * Sagha gap: gold here is priced at a dollar above the banks' rate, so it costs about that much
 * more than the world gram. Reads the display tier (stale but stamped, never blank).
 */
export function GoldPriceStrip() {
  const t = useT().wealthPage
  const { locale } = useLocale()
  const { lookupDisplay, refresh } = useAssetPrices()
  const state = useFinanceStore((s) => s.settings.wealthGoldStrip ?? 'collapsed')
  const officialFallback = useFinanceStore((s) => s.exchangeRates['USD_EGP'] ?? null)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const [now] = useState(() => Date.now())

  const vm = useMemo(() => {
    const saghaE = lookupDisplay('SAGHA_USD', 'EGP')
    const ounceE = lookupDisplay('XAU', 'USD')
    if (!saghaE || !ounceE) return null
    const official = lookupDisplay('OFFICIAL_USD', 'EGP')?.price ?? officialFallback
    const fresh = saghaE.fresh && ounceE.fresh
    const ageDays = Math.floor((now - Date.parse(saghaE.asOf)) / DAY_MS)
    return {
      fresh,
      ageDays,
      asOf: saghaE.asOf,
      prices: KARATS.map((k) => ({ k, egp: egyptKaratPrice(ounceE.price, saghaE.price, k) })),
      ounce: ounceE.price,
      gram: usdPerGram(ounceE.price),
      sagha: saghaE.price,
      gapPct: official ? (saghaE.price / official - 1) * 100 : null,
    }
  }, [lookupDisplay, officialFallback, now])

  if (state === 'hidden') return null
  const freshness: Freshness = !vm ? 'unavailable' : vm.fresh ? 'fresh' : 'stale'
  const expanded = state === 'expanded'
  const approx = freshness === 'stale' ? '≈' : ''
  const pill =
    freshness === 'fresh'
      ? { text: t.stripLive, cls: 'bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]' }
      : freshness === 'stale'
        ? { text: t.stripDaysOld(Math.max(1, vm!.ageDays)), cls: 'bg-[var(--color-brand-amber-soft)] text-[var(--color-brand-amber)]' }
        : { text: t.stripOffline, cls: 'bg-[var(--color-brand-amber-soft)] text-[var(--color-brand-amber)]' }
  const setState = (next: 'collapsed' | 'expanded' | 'hidden') => updateSettings({ wealthGoldStrip: next })

  return (
    <section className="mx-4 lg:mx-0 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] shadow-[var(--shadow-sm)]">
      <div className="grid grid-cols-3 divide-x divide-[var(--color-brand-border)] rtl:divide-x-reverse">
        {KARATS.map((k) => {
          const p = vm?.prices.find((x) => x.k === k)
          return (
            <div key={k} className="px-3 py-2.5">
              <span className="text-[0.6875rem] font-bold text-[var(--color-brand-gold)]">{k}k</span>
              <p className="mt-0.5 font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">
                {p ? `${approx}${formatWhole(p.egp)}` : '—'}
              </p>
            </div>
          )
        })}
      </div>
      {expanded && vm ? (
        <div className="grid grid-cols-3 divide-x divide-[var(--color-brand-border)] border-t border-[var(--color-brand-border)] rtl:divide-x-reverse">
          <div className="px-3 py-2.5">
            <span className="text-[0.6875rem] font-bold text-[var(--color-brand-gold)]">{t.worldOz}</span>
            <p className="mt-0.5 font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${formatWhole(vm.ounce)}</p>
          </div>
          <div className="px-3 py-2.5">
            <span className="text-[0.6875rem] font-bold text-[var(--color-brand-gold)]">{t.worldG}</span>
            <p className="mt-0.5 font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">${vm.gram.toFixed(2)}</p>
          </div>
          <div className="px-3 py-2.5">
            <span className="text-[0.6875rem] font-bold text-[var(--color-brand-gold)]">{t.saghaDollar}</span>
            <p className="mt-0.5 font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">
              {vm.sagha.toFixed(2)}
              {vm.gapPct != null ? (
                <span className="ms-1 text-[0.65625rem] font-bold text-[var(--color-brand-green)]">
                  {vm.gapPct >= 0 ? '+' : ''}{vm.gapPct.toFixed(1)}%
                </span>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-3 border-t border-[var(--color-brand-border)] px-3 py-1.5">
        <span className={cn('inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[0.71875rem] font-bold', pill.cls)}>
          {freshness === 'fresh' ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
          {pill.text}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-brand-text-secondary)]">
          {t.stripSagha}{vm ? ` · ${t.stripAsOf(freshness === 'fresh' ? formatClock(new Date(vm.asOf), locale) : formatLocalized(new Date(vm.asOf), 'd MMM', locale))}` : ''}
        </span>
        <IconButton aria-label={t.refreshPrices} size="sm" variant={freshness === 'fresh' ? 'ghost' : 'brand'} onClick={() => void refresh()}>
          <RefreshCw size={16} />
        </IconButton>
        {expanded ? (
          <IconButton aria-label={t.hideStrip} size="sm" onClick={() => setState('hidden')}>
            <X size={16} />
          </IconButton>
        ) : null}
        <IconButton aria-label={expanded ? t.hideWorld : t.showWorld} size="sm" onClick={() => setState(expanded ? 'collapsed' : 'expanded')}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </IconButton>
      </div>
    </section>
  )
}
