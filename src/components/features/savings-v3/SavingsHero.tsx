'use client'

import { ChevronRight, TrendingUp } from 'lucide-react'
import type { Currency } from '@/lib/store/types'
import type { SavingsPace } from '@/lib/savings/savingsPace'
import { fmtCompact } from '@/lib/utils/currency'

/** Signed compact figure with a leading + on positives; unsigned zero. */
function signed(n: number): string {
  if (n === 0) return '0'
  return `${n > 0 ? '+' : '−'}${fmtCompact(Math.abs(n))}`
}

const PACE = {
  ahead: { c: '#35D46F', text: (p: number) => `Ahead +${p}%` },
  onpace: { c: '#7EAEF9', text: () => 'On pace' },
  behind: { c: '#FFB13D', text: (p: number) => `Behind ${p}%` },
  none: { c: '#9898B0', text: () => 'Nothing saved yet' },
} as const

export interface SavingsHeroProps {
  netWorth: number // real net worth (balances + this month's flow − debt), matches dashboard
  netWorthUsd: number | null
  /** A holding couldn't be priced — net worth excludes it; show a subtle note. */
  incomplete?: boolean
  totalSaved: number
  thisMonth: number
  investment: number
  pace: SavingsPace
  currency: Currency
  empty: boolean
  onAddSavings: () => void
  onInvestment: () => void
}

const microLabel: React.CSSProperties = {
  fontSize: 8.5, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6E6E85',
}

export function SavingsHero({
  netWorth, netWorthUsd, incomplete, totalSaved, thisMonth, investment, pace, currency, empty,
  onAddSavings, onInvestment,
}: SavingsHeroProps) {
  const paceStyle = PACE[pace.state]
  return (
    <div
      className="relative overflow-hidden"
      style={{
        margin: '0 16px', padding: 16, borderRadius: 20,
        background: 'linear-gradient(152deg,#141b28,#0f1017)',
        border: '1px solid rgba(126,174,249,.18)',
        boxShadow: '0 18px 40px -24px rgba(0,0,0,.85)',
      }}
    >
      {/* glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          width: 190, height: 190, top: -60, right: -40,
          background: 'radial-gradient(circle, rgba(126,174,249,.20), transparent 68%)',
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between">
          <span style={{ ...microLabel, fontSize: 10, letterSpacing: '.08em', color: '#8FA6C7' }}>
            Net worth
          </span>
          {!empty && (
            <span
              className="inline-flex items-center gap-1"
              style={{
                height: 26, borderRadius: 999, padding: '0 10px',
                background: `rgba(${hexToRgb(paceStyle.c)},.14)`, border: `1px solid rgba(${hexToRgb(paceStyle.c)},.3)`,
                color: paceStyle.c, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
              }}
            >
              {pace.state === 'ahead' && <TrendingUp size={12} />}
              {paceStyle.text(pace.percent)}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex items-end gap-2">
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 32, letterSpacing: '-0.025em', color: '#fff', lineHeight: 1.05 }}>
            {netWorth.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
          <span style={{ fontWeight: 500, fontSize: 13, color: '#CFCFE0', paddingBottom: 4 }}>{currency}</span>
        </div>
        {netWorthUsd != null && (
          <div className="flex items-center gap-1.5" style={{ marginTop: 2 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 12.5, color: '#8FA6C7' }}>
              ≈ ${netWorthUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
            {incomplete && (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#FFB13D' }} title="A holding couldn't be priced — excluded">
                · incomplete
              </span>
            )}
          </div>
        )}

        {/* Allocation split — fills the hero's dead space with a real visual of where wealth sits. */}
        {totalSaved + investment > 0 && (() => {
          const total = totalSaved + investment
          const savedPct = Math.round((totalSaved / total) * 100)
          const invPct = 100 - savedPct
          return (
            <div className="mt-3">
              <div className="flex h-2 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,.08)' }}>
                <div style={{ width: `${savedPct}%`, background: '#35D46F' }} />
                <div style={{ width: `${invPct}%`, background: '#F5C842' }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between" style={{ fontSize: 10.5, fontWeight: 600 }}>
                <span className="inline-flex items-center gap-1" style={{ color: '#35D46F' }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: '#35D46F' }} />Saved {savedPct}%</span>
                <span className="inline-flex items-center gap-1" style={{ color: '#F5C842' }}>Invested {invPct}%<span className="h-1.5 w-1.5 rounded-full" style={{ background: '#F5C842' }} /></span>
              </div>
            </div>
          )
        })()}

        {/* cell strip */}
        <div
          className="mt-3 flex items-stretch"
          style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 13 }}
        >
          <Cell label="Total saved" value={fmtCompact(totalSaved)} />
          <Cell label="This month" value={signed(thisMonth)} valueColor="#35D46F" />
          <Cell label="Investment" value={fmtCompact(investment)} valueColor="#F5C842" chevron onClick={onInvestment} last />
        </div>

        <button
          type="button"
          onClick={onAddSavings}
          className="mt-3 w-full text-white active:scale-[.99] transition-transform"
          style={{ height: 46, borderRadius: 13, background: '#E50914', fontWeight: 600, fontSize: 15 }}
        >
          Add savings
        </button>
      </div>
    </div>
  )
}

function Cell({
  label, value, valueColor = '#fff', chevron, onClick, last,
}: {
  label: string; value: string; valueColor?: string; chevron?: boolean; onClick?: () => void; last?: boolean
}) {
  const inner = (
    <>
      <span className="inline-flex items-center gap-0.5" style={microLabel}>
        {label}
        {chevron && <ChevronRight size={10} />}
      </span>
      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 14.5, color: valueColor, marginTop: 2 }}>
        {value}
      </div>
    </>
  )
  return (
    <div
      className="flex flex-1 flex-col items-start"
      style={{ padding: '10px 11px', minHeight: 52, borderRight: last ? undefined : '1px solid rgba(255,255,255,.07)' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {inner}
    </div>
  )
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r},${g},${b}`
}
