'use client'

import { useState } from 'react'
import { fitBigNumber } from '@/components/features/hero/fitText'
import { EyeOff } from 'lucide-react'
import { BAND_FG2, BAND_MIX, BandScale, HeroBand } from '@/components/features/hero/HeroBand'
import { IconButton } from '@/components/ui/IconButton'
import { MASK } from '@/lib/privacy/mask'
import { useLocale, useT } from '@/lib/i18n'
import type { AccountsModel } from '@/lib/accounts/useAccounts'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { heroFigure, moneyFlex } from './accountDisplay'

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
  /** "Set aside" in the note opens the Set aside list. */
  onSetAside?: () => void
  /** An account holds less than what is set aside in it: "CIB is short 2,400" leads the note and opens the shortfall. */
  short?: { text: string; onPress: () => void }
}

/** Note-line buttons keep a 44px target past their text. */
const NOTE_HIT = "relative after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']"

/** The three biggest providers, then the rest as one segment. */
export function heroSplit(segments: HeroSegment[]): { shown: HeroSegment[]; rest: number; total: number } {
  const sorted = segments.filter((s) => s.value > 0).sort((a, b) => b.value - a.value)
  const total = sorted.reduce((s, x) => s + x.value, 0)
  return { shown: sorted.slice(0, 3), rest: sorted.slice(3).reduce((s, x) => s + x.value, 0), total }
}

/** The Accounts hero (Light touch): a rounded card with what is free, net worth, the split by provider and one note line. */
export function AccountsHero({ model, currency, netWorth, creditOwed, segments, hidden, onToggleHidden, onSetAside, short }: AccountsHeroProps) {
  const t = useT().accountsPage
  const copy = useAccountsLtCopy()
  const lt = copy.hero
  const v9 = copy.v9
  const { locale } = useLocale()
  const [exact, setExact] = useState<'free' | 'nw' | null>(null)
  const free = model.freeInBase
  const fmt = (n: number) => (hidden ? MASK : moneyFlex(n, currency))
  const big = heroFigure(free, currency, locale)
  const nwFig = heroFigure(netWorth, currency, locale)
  const shownExact = hidden ? null : exact
  const toggle = (k: 'free' | 'nw') => setExact(exact === k ? null : k)
  const dotted = 'underline decoration-dotted decoration-2 underline-offset-[6px] decoration-[color-mix(in_oklab,var(--flow-band-fg)_45%,transparent)]'
  const { shown, rest, total } = heroSplit(segments)
  const bars = rest > 0 ? [...shown, { key: 'rest', label: '', value: rest }] : shown
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0)
  return (
    <HeroBand
      contained
      label={v9.freeToSpend}
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
            {hidden ? (
              <span className="shrink-0 font-mono-numbers text-[32px] font-semibold leading-none tracking-[-0.03em]">{MASK}</span>
            ) : (
              <button type="button" onClick={() => toggle('free')} aria-expanded={exact === 'free'} data-raw-button-ok="the hero figure itself: a tap shows the exact amount"
                aria-label={v9.showExact(v9.freeToSpend, `${moneyFlex(free, currency)} ${currency}`)}
                className={`-my-[5px] min-w-0 shrink py-[5px] text-start font-mono-numbers font-semibold leading-none tracking-[-0.03em] ${fitBigNumber(big.text)} ${big.compact ? dotted : ''}`}>
                {big.text}
              </button>
            )}
            <span className={`min-w-0 truncate whitespace-nowrap text-[0.8125rem] ${BAND_FG2}`}>{currency}</span>
          </p>
          {hidden ? (
            <p className={`shrink-0 text-end text-[0.71875rem] leading-[1.3] ${BAND_FG2}`}>
              <b className="block font-mono-numbers text-[0.9375rem] text-[var(--flow-band-fg)]">{MASK}</b>
              {t.netWorth}
            </p>
          ) : (
            <button type="button" onClick={() => toggle('nw')} aria-expanded={exact === 'nw'} data-raw-button-ok="the net worth figure: a tap shows the exact amount"
              aria-label={v9.showExact(t.netWorth, `${moneyFlex(netWorth, currency)} ${currency}`)}
              className={`-me-1 min-h-11 shrink-0 rounded-lg px-1 text-end text-[0.71875rem] leading-[1.3] ${BAND_FG2}`}>
              <b className={`block font-mono-numbers text-[0.9375rem] text-[var(--flow-band-fg)] ${nwFig.compact ? 'underline decoration-dotted underline-offset-4' : ''}`}>{nwFig.text}</b>
              {t.netWorth}
            </button>
          )}
        </>
      }
      afterNumbers={shownExact ? (
        <p role="status" className="mt-1.5 inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--flow-band-fg)_16%,transparent)] px-3 font-mono-numbers text-[0.8125rem] font-semibold">
          {shownExact === 'nw'
            ? v9.exactlyOf(t.netWorth, `${moneyFlex(netWorth, currency)} ${currency}`)
            : v9.exactly(`${moneyFlex(free, currency)} ${currency}`)}
        </p>
      ) : undefined}
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
      note={short || model.heldInBase > 0 || creditOwed > 0 ? (
        <span>
          {[
            short ? (
              <button key="short" type="button" onClick={short.onPress} data-raw-button-ok="an inline link in the hero's note line" className={`${NOTE_HIT} font-bold text-[var(--flow-band-fg)]`}>{short.text}</button>
            ) : null,
            model.heldInBase > 0 ? (
              <button key="aside" type="button" onClick={onSetAside} disabled={!onSetAside} data-raw-button-ok="an inline link in the hero's note line" className={NOTE_HIT}>
                <b className="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">{fmt(model.heldInBase)}</b> {lt.setAside}
              </button>
            ) : null,
            creditOwed > 0 ? <span key="owed"><b className="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">{fmt(creditOwed)}</b> {lt.owedOnCards}</span> : null,
          ].filter(Boolean).flatMap((el, i) => (i ? [<span key={`d${i}`}> · </span>, el] : [el]))}
        </span>
      ) : undefined}
    />
  )
}
