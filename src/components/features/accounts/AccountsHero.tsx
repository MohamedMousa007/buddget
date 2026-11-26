'use client'

import { fitBigNumber } from '@/components/features/hero/fitText'
import { EyeOff } from 'lucide-react'
import { BAND_FG2, BAND_MIX, BandScale, HeroBand } from '@/components/features/hero/HeroBand'
import { IconButton } from '@/components/ui/IconButton'
import { MASK } from '@/lib/privacy/mask'
import { useT } from '@/lib/i18n'
import type { AccountsModel } from '@/lib/accounts/useAccounts'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { moneyFlex, smartSplit } from './accountDisplay'

/** Legend squares, as the mockup draws them: band ink, gold, then ink at 62%. */
const TONES = ['var(--flow-band-fg)', 'var(--color-brand-gold)', 'color-mix(in oklab, var(--flow-band-fg) 62%, transparent)', 'color-mix(in oklab, var(--flow-band-fg) 40%, transparent)']
/** Bar segments, as the mockup draws them: band ink, separated by lighter tones toward the rest (opacity 1, 1, .62, .4). */
const BAR_OPACITY = [1, 1, 0.62, 0.4]

/** One provider (or Cash) in the split bar, in the base currency. */
export interface HeroSegment {
  key: string
  label: string
  value: number
}

interface AccountsHeroProps {
  model: AccountsModel
  currency: string
  netWorth: number
  creditOwed: number
  /** Per provider, so two accounts at one bank read as one "HSBC 100%", never "HSBC 99% · HSBC 1%". */
  segments: HeroSegment[]
  hidden: boolean
  onToggleHidden: () => void
}

/** The three biggest providers, then the rest as one segment. */
export function heroSplit(segments: HeroSegment[]): { shown: HeroSegment[]; rest: number; total: number } {
  const sorted = segments.filter((s) => s.value > 0).sort((a, b) => b.value - a.value)
  const total = sorted.reduce((s, x) => s + x.value, 0)
  return { shown: sorted.slice(0, 3), rest: sorted.slice(3).reduce((s, x) => s + x.value, 0), total }
}

/** The Accounts hero (Light touch): a rounded card with what is free, net worth, the split by provider and one note line. */
export function AccountsHero({ model, currency, netWorth, creditOwed, segments, hidden, onToggleHidden }: AccountsHeroProps) {
  const t = useT().accountsPage
  const lt = useAccountsLtCopy().hero
  const free = model.freeInBase
  const fmt = (n: number) => (hidden ? MASK : moneyFlex(n, currency))
  const big = smartSplit(free, currency)
  const { shown, rest, total } = heroSplit(segments)
  const bars = rest > 0 ? [...shown, { key: 'rest', label: '', value: rest }] : shown
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0)
  const facts = [
    model.heldInBase > 0 ? { v: model.heldInBase, l: lt.setAside } : null,
    creditOwed > 0 ? { v: creditOwed, l: lt.owedOnCards } : null,
  ].filter((f): f is { v: number; l: string } => f !== null)
  return (
    <HeroBand
      contained
      label={t.availableNow}
      // The mockup's hero has no eye. Hiding balances lives in Settings > Privacy; while they are hidden, the eye stays
      // here so they can be shown again where they were masked.
      aside={hidden ? (
        <IconButton onClick={onToggleHidden} aria-label={t.showBalances} aria-pressed variant="onBand" size="sm">
          <EyeOff className="size-4" aria-hidden />
        </IconButton>
      ) : undefined}
      numbers={
        <>
          <p className="flex min-w-0 items-baseline gap-1.5">
            {model.approx ? <span className={`shrink-0 text-[0.9375rem] ${BAND_FG2}`}>≈</span> : null}
            <span className={`shrink-0 font-mono-numbers font-semibold leading-none tracking-[-0.03em] ${hidden ? 'text-[32px]' : fitBigNumber(big.int + big.dec)}`}>
              {hidden ? MASK : <>{big.int}<span className="opacity-45">{big.dec}</span></>}
            </span>
            <span className={`min-w-0 truncate whitespace-nowrap text-[0.8125rem] ${BAND_FG2}`}>{currency}</span>
          </p>
          <p className={`shrink-0 text-end text-[0.71875rem] leading-[1.3] ${BAND_FG2}`}>
            <b className="block font-mono-numbers text-[0.9375rem] text-[var(--flow-band-fg)]">{fmt(netWorth)}</b>
            {t.netWorth}
          </p>
        </>
      }
      bar={
        <>
          <div className="flex h-1.5 gap-[3px]" style={total > 0 ? undefined : { background: BAND_MIX, borderRadius: 9999 }}>
            {bars.map((s, i) => <span key={s.key} className="h-full rounded-full bg-[var(--flow-band-fg)]" style={{ width: `${pct(s.value)}%`, opacity: BAR_OPACITY[s.key === 'rest' ? 3 : i] }} />)}
          </div>
          <BandScale>
            {/* Names are never cut ("CIB 44%"): a legend entry that does not fit wraps onto a hidden second line. */}
            <span className="flex h-[15.75px] min-w-0 flex-wrap items-center gap-x-3 overflow-hidden">
              {shown.map((s, i) => (
                <span key={s.key} className="inline-flex h-[15.75px] shrink-0 items-center gap-1.5 whitespace-nowrap">
                  <span className="size-2 shrink-0 rounded-[2px]" style={{ background: TONES[i] }} aria-hidden />
                  {s.label} {Math.round(pct(s.value))}%
                </span>
              ))}
            </span>
            <span className="shrink-0 whitespace-nowrap">{t.accountsCount(model.accounts.length)}</span>
          </BandScale>
        </>
      }
      note={facts.length > 0 ? (
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {facts.map((f) => (
            <span key={f.l}><b className="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">{fmt(f.v)}</b> {f.l}</span>
          ))}
        </span>
      ) : undefined}
    />
  )
}
