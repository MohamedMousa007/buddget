'use client'

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ChevronRight, Pencil, Plus, TrendingUp } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAssetPrices } from '@/hooks/useAssetPrices'
import { useNetWorth } from '@/hooks/useNetWorth'
import { valueInvestmentHolding, saghaRate, type PriceLookup } from '@/lib/savings/holdingValuation'
import { egyptKaratPrice, usdPerGram } from '@/lib/prices/egyptGold'
import { convertCurrency } from '@/lib/utils/currency'
import type { GoldKarat, InvestmentAssetType, InvestmentHolding } from '@/lib/store/types'

const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US')
const fmtCompact = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `${Math.round(n / 1e3)}K`
  return `${Math.round(n)}`
}
const micro: React.CSSProperties = { fontSize: 8.5, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6E6E85' }

const TABS: Array<{ key: InvestmentAssetType; label: string }> = [
  { key: 'gold', label: 'Gold' }, { key: 'crypto', label: 'Crypto' }, { key: 'stock', label: 'Stocks' }, { key: 'property', label: 'Property' },
]
const ADD_LABEL: Record<InvestmentAssetType, string> = { gold: 'Add gold', crypto: 'Add a coin', stock: 'Add a position', property: 'Add a property' }

export interface InvestmentViewProps {
  onBackToSavings: () => void
  onAddInvestment: (type: InvestmentAssetType) => void
}

export function InvestmentView({ onBackToSavings, onAddInvestment }: InvestmentViewProps) {
  const { lookup } = useAssetPrices()
  const nw = useNetWorth()
  const { investmentHoldings, settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({ investmentHoldings: s.investmentHoldings, settings: s.settings, exchangeRates: s.exchangeRates })),
  )
  const [tab, setTab] = useState<InvestmentAssetType>('gold')

  const toBase = useCallback((egp: number) => convertCurrency(egp, 'EGP', settings.baseCurrency, exchangeRates), [settings.baseCurrency, exchangeRates])

  const totals = useMemo(() => {
    let value = 0, putIn = 0
    for (const h of investmentHoldings) {
      const v = valueInvestmentHolding(h, lookup)
      if (v.priced && v.value != null) value += toBase(v.value)
      if (h.unitCost != null) putIn += convertCurrency(h.unitCost * h.quantity, h.costBasisCurrency ?? settings.baseCurrency, settings.baseCurrency, exchangeRates)
    }
    return { value, putIn, allTime: value - putIn }
  }, [investmentHoldings, lookup, settings.baseCurrency, exchangeRates, toBase])

  const valueUsd = convertCurrency(totals.value, settings.baseCurrency, 'USD', exchangeRates)
  const growthPct = totals.putIn > 0 ? (totals.allTime / totals.putIn) * 100 : 0
  const held = investmentHoldings.filter((h) => h.assetType === tab)

  return (
    <div className="pb-24">
      <div className="pt-3 space-y-4">
        {/* hero (gold skin) */}
        <div className="relative overflow-hidden" style={{ margin: '0 16px', padding: 16, borderRadius: 20, background: 'linear-gradient(152deg,#1e1a10,#111017)', border: '1px solid rgba(245,200,66,.2)', boxShadow: '0 18px 40px -24px rgba(0,0,0,.85)' }}>
          <div aria-hidden className="pointer-events-none absolute" style={{ width: 190, height: 190, top: -60, right: -40, background: 'radial-gradient(circle, rgba(245,200,66,.22), transparent 68%)' }} />
          <div className="relative">
            <div className="flex items-start justify-between">
              <span style={{ ...micro, fontSize: 10, letterSpacing: '.08em', color: '#B8A87C' }}>Value of what you hold</span>
              {totals.putIn > 0 && totals.value > 0 && (() => {
                const c = growthPct >= 0 ? '#35D46F' : '#FF6B6B'
                return (
                  <span className="inline-flex items-center gap-1" style={{ height: 26, borderRadius: 999, padding: '0 10px', background: `rgba(${growthPct >= 0 ? '53,212,111' : '255,107,107'},.14)`, border: `1px solid rgba(${growthPct >= 0 ? '53,212,111' : '255,107,107'},.3)`, color: c, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11 }}>
                    <TrendingUp size={12} />{growthPct >= 0 ? '+' : ''}{growthPct.toFixed(1)}% a year
                  </span>
                )
              })()}
            </div>
            <div className="mt-1.5 flex items-end gap-2">
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 32, letterSpacing: '-0.025em', color: '#fff', lineHeight: 1.05 }}>{fmtNum(totals.value)}</span>
              <span style={{ fontWeight: 500, fontSize: 13, color: '#CFCFE0', paddingBottom: 4 }}>{settings.baseCurrency}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 12.5, color: '#B8A87C', marginTop: 2 }}>≈ ${fmtNum(valueUsd)}</div>
            <div className="mt-3 flex" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 13 }}>
              <HeroCell label="Put in" value={fmtCompact(totals.putIn)} />
              <HeroCell label="All time" value={`${totals.allTime >= 0 ? '+' : ''}${fmtCompact(totals.allTime)}`} color={totals.allTime >= 0 ? '#35D46F' : '#FF6B6B'} trend={totals.allTime >= 0} />
              <HeroCell label="Net worth" value={fmtCompact(nw.netWorth)} onClick={onBackToSavings} chevron last />
            </div>
            <button type="button" onClick={() => onAddInvestment(tab)} className="mt-3 w-full text-white" style={{ height: 46, borderRadius: 13, background: '#E50914', fontWeight: 600, fontSize: 15 }}>Add investment</button>
          </div>
        </div>

        {/* segmented control */}
        <div className="mx-4 flex gap-[3px] rounded-[13px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-1">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className="flex-1 rounded-[10px] text-[12px] font-semibold transition-all"
              style={{ height: 36, background: tab === t.key ? '#E50914' : 'transparent', color: tab === t.key ? '#fff' : 'var(--color-brand-text-muted)', boxShadow: tab === t.key ? '0 4px 12px -6px rgba(229,9,20,.7)' : undefined }}>
              {t.label}
            </button>
          ))}
        </div>

        {held.length > 0 ? (
          <HoldingsCard type={tab} holdings={held} lookup={lookup} toBase={toBase} onAdd={() => onAddInvestment(tab)} />
        ) : (
          <div className="space-y-3">
            {tab === 'gold' && <GoldMarketCard lookup={lookup} />}
            <button type="button" onClick={() => onAddInvestment(tab)} className="mx-4 flex w-[calc(100%-32px)] items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-brand-border)] py-4 text-sm font-semibold text-[var(--color-brand-text-secondary)]">
              <Plus size={16} /> {ADD_LABEL[tab]}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function HeroCell({ label, value, color = '#fff', chevron, trend, onClick, last }: { label: string; value: string; color?: string; chevron?: boolean; trend?: boolean; onClick?: () => void; last?: boolean }) {
  return (
    <div className="flex-1" style={{ padding: '10px 11px', borderRight: last ? undefined : '1px solid rgba(255,255,255,.07)' }} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="flex items-center gap-0.5" style={micro}>{label}{chevron && <ChevronRight size={10} />}</div>
      <div className="mt-0.5 flex items-center gap-1">
        {trend && <TrendingUp size={11} color="#35D46F" />}
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 14.5, color }}>{value}</span>
      </div>
    </div>
  )
}

function HoldingsCard({ type, holdings, lookup, toBase, onAdd }: { type: InvestmentAssetType; holdings: InvestmentHolding[]; lookup: Parameters<typeof valueInvestmentHolding>[1]; toBase: (n: number) => number; onAdd: () => void }) {
  const rows = holdings.map((h) => {
    const v = valueInvestmentHolding(h, lookup)
    return { h, worth: v.priced && v.value != null ? toBase(v.value) : null }
  })
  const total = rows.reduce((s, r) => s + (r.worth ?? 0), 0)
  const putIn = holdings.reduce((s, h) => s + (h.unitCost != null ? h.unitCost * h.quantity : 0), 0)
  const cols: Record<InvestmentAssetType, [string, string, string]> = {
    gold: ['Karat', 'Grams', 'Worth'], crypto: ['Coin', 'Amount', 'Worth'], stock: ['Position', 'Shares', 'Worth'], property: ['Property', 'Size', 'Worth'],
  }
  return (
    <div className="mx-4 overflow-hidden rounded-[18px] border border-[var(--color-brand-border)]">
      <div className="p-4" style={{ background: 'linear-gradient(150deg, rgba(245,200,66,.12), transparent 72%)' }}>
        <p style={{ ...micro, fontSize: 9 }}>{type === 'gold' ? 'What a shop would pay you today' : 'What it is worth today'}</p>
        <p className="mt-1 font-mono-numbers text-[26px] font-semibold text-[var(--color-brand-text-primary)]">{fmtNum(total)} <span className="text-sm text-[var(--color-brand-text-muted)]">EGP</span></p>
        <p className="font-mono-numbers text-[10.5px] text-[var(--color-brand-text-muted)]">{fmtNum(putIn)} put in</p>
      </div>
      <div className="grid grid-cols-3 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 py-2" style={{ ...micro }}>
        <span>{cols[type][0]}</span><span className="text-right">{cols[type][1]}</span><span className="text-right">{cols[type][2]}</span>
      </div>
      {rows.map(({ h, worth }) => (
        <div key={h.id} className="flex items-center gap-2 border-t border-[var(--color-brand-border)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono-numbers text-[13.5px] font-semibold text-[var(--color-brand-text-primary)]">{type === 'gold' ? `${h.karat}k` : h.name}</p>
            {h.purchaseDate && <p className="font-mono-numbers text-[9.5px] text-[var(--color-brand-text-muted)]">Bought {new Date(h.purchaseDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>}
          </div>
          <span className="w-16 text-right font-mono-numbers text-[12.5px] text-[var(--color-brand-text-secondary)]">{fmtNum(h.quantity)}{type === 'gold' ? ' g' : ''}</span>
          <span className="w-[92px] text-right font-mono-numbers text-[13.5px] font-semibold text-[var(--color-brand-text-primary)]">{worth != null ? fmtNum(worth) : '—'}</span>
          <button type="button" aria-label="Edit" className="text-[var(--color-brand-text-muted)]"><Pencil size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={onAdd} className="w-full border-t border-[var(--color-brand-border)] py-3 text-center text-sm font-semibold" style={{ color: '#E50914' }}>+ {type === 'gold' ? 'Add more gold' : 'Add more'}</button>
    </div>
  )
}

function GoldMarketCard({ lookup }: { lookup: PriceLookup }) {
  const sagha = saghaRate(lookup)
  const ounceUsd = lookup('XAU', 'USD')?.price ?? null
  const priced = sagha != null && ounceUsd != null
  const karats: GoldKarat[] = [24, 21, 18]
  return (
    <div className="mx-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-[15px] font-bold text-[var(--color-brand-text-primary)]">Gold today · Egypt</h3>
        <span className="text-xs text-[var(--color-brand-text-muted)]">{priced ? 'Live' : 'Unavailable'}</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-brand-border)]">
        <div className="p-4" style={{ background: 'linear-gradient(150deg, rgba(245,200,66,.12), transparent 72%)' }}>
          <p style={{ ...micro, fontSize: 9 }}>24k · what a shop pays you</p>
          <p className="mt-1 font-mono-numbers text-[26px] font-semibold text-[var(--color-brand-text-primary)]">{priced ? fmtNum(egyptKaratPrice(ounceUsd, sagha, 24)) : '—'} <span className="text-sm text-[var(--color-brand-text-muted)]">EGP/g</span></p>
        </div>
        {priced ? karats.map((k) => (
          <div key={k} className="flex items-center border-t border-[var(--color-brand-border)] px-4 py-3">
            <span className="flex-1 text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{k}k</span>
            <span className="font-mono-numbers text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{fmtNum(egyptKaratPrice(ounceUsd, sagha, k))} <span className="text-xs text-[var(--color-brand-text-muted)]">/g</span></span>
          </div>
        )) : (
          <div className="border-t border-[var(--color-brand-border)] px-4 py-4 text-center text-sm text-[var(--color-brand-text-muted)]">Live gold prices are refreshing — check back shortly.</div>
        )}
        {priced && (
          <div className="border-t border-[var(--color-brand-border)] px-4 py-3">
            <p className="text-xs text-[var(--color-brand-text-muted)]">Ounce global ${ounceUsd.toFixed(2)} · gram 24k global {fmtNum(usdPerGram(ounceUsd))} · Egyptian gold is priced off the Sagha dollar ({sagha.toFixed(2)}), not the official rate. Shown in EGP.</p>
          </div>
        )}
      </div>
    </div>
  )
}
