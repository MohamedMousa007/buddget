'use client'

import { Eye, EyeOff } from 'lucide-react'
import { BAND_FG2, BAND_MIX, BandScale, HeroBand } from '@/components/features/hero/HeroBand'
import { IconButton } from '@/components/ui/IconButton'
import { MASK } from '@/lib/privacy/mask'
import { useT } from '@/lib/i18n'
import type { AccountsModel } from '@/lib/accounts/useAccounts'
import { splitMoney } from './accountDisplay'

const TONES = ['var(--flow-band-fg)', 'var(--color-brand-gold)', 'color-mix(in oklab, var(--flow-band-fg) 62%, transparent)', 'color-mix(in oklab, var(--flow-band-fg) 40%, transparent)']

interface AccountsHeroProps {
  model: AccountsModel
  currency: string
  netWorth: number
  creditOwed: number
  hidden: boolean
  onToggleHidden: () => void
}

/** The Accounts band: what is free right now, net worth beside it, the split bar and three facts. */
export function AccountsHero({ model, currency, netWorth, creditOwed, hidden, onToggleHidden }: AccountsHeroProps) {
  const t = useT().accountsPage
  const free = Math.max(0, model.totalInBase - model.heldInBase)
  const fmt = (n: number) => (hidden ? MASK : splitMoney(n, currency).int)
  const big = splitMoney(free, currency)
  const tracked = model.accounts.filter((a) => a.balance)
  const segs = tracked
    .map((a) => ({ key: a.method.id, label: a.method.name, value: a.balance!.balance }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
  const total = segs.reduce((s, x) => s + x.value, 0) || 1
  return (
    <HeroBand
      label={t.availableNow}
      aside={
        <IconButton onClick={onToggleHidden} aria-label={hidden ? t.showBalances : t.hideBalances} variant="onBand" size="sm">
          {hidden ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </IconButton>
      }
      numbers={
        <>
          <p className="flex min-w-0 items-baseline gap-1.5">
            {model.approx ? <span className={`shrink-0 text-[15px] ${BAND_FG2}`}>≈</span> : null}
            <span className="shrink-0 font-mono-numbers text-[32px] font-semibold leading-none tracking-[-0.03em]">
              {hidden ? MASK : <>{big.int}<span className="opacity-45">{big.dec}</span></>}
            </span>
            <span className={`min-w-0 truncate whitespace-nowrap text-[13px] ${BAND_FG2}`}>{currency}</span>
          </p>
          <p className={`shrink-0 text-end text-[11.5px] leading-[1.3] ${BAND_FG2}`}>
            <b className="block font-mono-numbers text-[15px] text-[var(--flow-band-fg)]">{fmt(netWorth)}</b>
            {t.netWorth}
          </p>
        </>
      }
      bar={
        <>
          <div className="flex h-1.5 gap-px overflow-hidden rounded-full" style={{ background: BAND_MIX }}>
            {segs.slice(0, 4).map((s, i) => <span key={s.key} className="h-full" style={{ width: `${(s.value / total) * 100}%`, background: TONES[i] }} />)}
          </div>
          <BandScale>
            <span className="flex min-w-0 items-center gap-3">
              {segs.slice(0, 3).map((s, i) => (
                <span key={s.key} className="inline-flex shrink-0 items-center gap-1">
                  <span className="size-2 rounded-[2px]" style={{ background: TONES[i] }} aria-hidden />
                  {s.label.split(' ')[0]} {Math.round((s.value / total) * 100)}%
                </span>
              ))}
            </span>
            <span className="min-w-0 truncate whitespace-nowrap">{t.accountsCount(model.accounts.length)}</span>
          </BandScale>
        </>
      }
      cells={[
        { label: t.inAccounts, value: fmt(model.totalInBase) },
        { label: t.setAside, value: fmt(model.heldInBase) },
        { label: t.creditOwed, value: fmt(creditOwed) },
      ]}
    />
  )
}
