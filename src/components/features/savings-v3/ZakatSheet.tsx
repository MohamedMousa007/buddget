'use client'

import { useMemo, useState } from 'react'
import { Wallet, Gem, Bitcoin, TrendingUp, Home, CreditCard, BookOpen, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { computeZakat } from '@/lib/savings/zakat'
import type { ZakatBase } from '@/lib/savings/zakatInputs'
import type { ZakatConfig } from '@/lib/store/types'

const micro: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-brand-text-muted)' }
const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US')
const hexToRgb = (hex: string) => { const h = hex.replace('#', ''); return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}` }

export interface ZakatSheetProps {
  open: boolean
  onClose: () => void
  base: ZakatBase
  hawlDate: string
}

type LineId = 'cash' | 'gold' | 'crypto' | 'stocks' | 'debts'

export function ZakatSheet({ open, onClose, base, hawlDate }: ZakatSheetProps) {
  const updateProfile = useFinanceStore((s) => s.updateProfile)
  const cfg = useFinanceStore((s) => s.profile.zakatConfig) ?? undefined

  const [nisabBasis, setNisabBasis] = useState<'silver' | 'gold'>(cfg?.nisabBasis ?? 'silver')
  const [holdsForTrading, setHoldsForTrading] = useState(cfg?.holdsForTrading ?? false)
  const [manualOn, setManualOn] = useState(cfg?.manualAmount != null)
  const [manualAmount, setManualAmount] = useState(cfg?.manualAmount != null ? String(cfg.manualAmount) : '')
  const [overrides, setOverrides] = useState<Record<string, number>>(cfg?.lineOverrides ?? {})

  const val = (id: LineId, live: number) => (overrides[id] != null ? overrides[id] : live)
  const cash = val('cash', base.cashAndSavings)
  const gold = val('gold', base.goldValue)
  const crypto = val('crypto', base.cryptoValue)
  const stocks = val('stocks', base.stocksValue)
  const debts = val('debts', base.debtsDueThisYear)

  const result = useMemo(() => computeZakat({
    cashAndSavings: cash, goldValue: gold, cryptoValue: crypto, stocksValue: stocks,
    holdsForTrading, debtsDueThisYear: debts, nisabBasis,
    gold24kSellPerGram: base.gold24kSellPerGram, silverPerGram: base.silverPerGram,
    manualAmount: manualOn ? parseFloat(manualAmount) || 0 : null,
  }), [cash, gold, crypto, stocks, holdsForTrading, debts, nisabBasis, base, manualOn, manualAmount])

  const save = (patch: Partial<ZakatConfig>) => updateProfile({ zakatConfig: { nisabBasis, holdsForTrading, manualAmount: manualOn ? parseFloat(manualAmount) || 0 : null, lineOverrides: overrides, ...patch } })
  const editLine = (id: LineId, raw: string) => {
    const next = { ...overrides }
    if (raw.trim() === '') delete next[id]
    else next[id] = parseFloat(raw.replace(/,/g, '')) || 0
    setOverrides(next); save({ lineOverrides: next })
  }

  const silverNisab = 595 * base.silverPerGram
  const goldNisab = 85 * base.gold24kSellPerGram
  const accent = result.due ? '#F5C842' : '#35D46F'

  if (!open) return null

  const rows: Array<{ id: LineId; icon: React.ReactNode; color: string; name: string; sub: string; value: number; negative?: boolean }> = [
    { id: 'cash', icon: <Wallet size={18} />, color: '#7EAEF9', name: 'Cash & savings', sub: 'Every pocket you hold', value: cash },
    { id: 'gold', icon: <Gem size={18} />, color: '#F5C842', name: 'Gold', sub: "At today's sell price", value: gold },
    { id: 'crypto', icon: <Bitcoin size={18} />, color: '#B79CFF', name: 'Crypto', sub: 'Treated like cash', value: crypto },
    { id: 'stocks', icon: <TrendingUp size={18} />, color: '#35D46F', name: 'Stocks', sub: `${holdsForTrading ? 'For trading · 100%' : 'Long-term · 30%'} counted`, value: stocks },
  ]

  return (
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="flex flex-col" style={{ maxHeight: '92vh' }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-[22px] font-bold text-[var(--color-brand-text-primary)]">Zakat</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-4">
          {/* verdict */}
          <div className="relative overflow-hidden rounded-2xl border p-4" style={{ borderColor: `rgba(${hexToRgb(accent)},.35)`, background: `rgba(${hexToRgb(accent)},.05)` }}>
            <p className="text-sm font-semibold" style={{ color: accent }}>{result.due ? 'Zakat is due' : 'No zakat due'}</p>
            <p className="mt-1 font-mono-numbers text-[30px] font-bold text-[var(--color-brand-text-primary)]">{result.due ? fmtNum(result.zakat) : '—'} <span className="text-base text-[var(--color-brand-text-muted)]">EGP</span></p>
            <p className="mt-1 font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{result.due ? `2.5% × ${fmtNum(result.zakatable)} EGP zakatable` : `You are ${fmtNum(result.gap)} EGP under the line`}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,.1)' }}><div style={{ width: `${Math.min(100, result.nisab > 0 ? (result.zakatable / result.nisab) * 100 : 0)}%`, height: '100%', background: accent }} /></div>
            <div className="mt-2 flex justify-between font-mono-numbers text-[11px] text-[var(--color-brand-text-muted)]"><span>Nisab · {fmtNum(result.nisab)} EGP</span><span>Hawl ends {hawlDate}</span></div>
          </div>

          {/* what counts */}
          <div>
            <p style={micro}>What counts</p>
            <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--color-brand-border)]">
              {rows.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 p-3" style={{ borderTop: i ? '1px solid var(--color-brand-border)' : undefined }}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `rgba(${hexToRgb(r.color)},.14)`, color: r.color }}>{r.icon}</span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{r.name}</p><p className="text-[11px] text-[var(--color-brand-text-muted)]">{r.sub}</p></div>
                  <input inputMode="numeric" defaultValue={fmtNum(r.value)} onBlur={(e) => editLine(r.id, e.target.value)}
                    className="h-9 w-[84px] rounded-[11px] bg-[var(--color-brand-elevated)] px-2 text-right font-mono-numbers text-sm text-[var(--color-brand-text-primary)]"
                    style={{ border: overrides[r.id] != null ? '1px solid rgba(229,9,20,.5)' : '1px solid transparent' }} />
                </div>
              ))}
              {/* property */}
              <div className="flex items-center gap-3 p-3" style={{ borderTop: '1px solid var(--color-brand-border)' }}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(44,224,198,.14)', color: '#2CE0C6' }}><Home size={18} /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">Property</p><p className="text-[11px] text-[var(--color-brand-text-muted)]">Not counted — only rent you kept</p></div>
                <span className="rounded-full border border-dashed border-[var(--color-brand-border)] px-3 py-1.5 text-[11px] text-[var(--color-brand-text-muted)]">Not counted</span>
              </div>
              {/* debts (negative) */}
              <div className="flex items-center gap-3 p-3" style={{ borderTop: '1px solid var(--color-brand-border)' }}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(255,107,107,.14)', color: '#FF6B6B' }}><CreditCard size={18} /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">Debts due this year</p><p className="text-[11px] text-[var(--color-brand-text-muted)]">Subtracted from your wealth</p></div>
                <span className="mr-1 text-sm" style={{ color: '#FF6B6B' }}>−</span>
                <input inputMode="numeric" defaultValue={fmtNum(debts)} onBlur={(e) => editLine('debts', e.target.value)}
                  className="h-9 w-[76px] rounded-[11px] bg-[var(--color-brand-elevated)] px-2 text-right font-mono-numbers text-sm" style={{ color: '#FF6B6B', border: overrides.debts != null ? '1px solid rgba(229,9,20,.5)' : '1px solid transparent' }} />
              </div>
              <div className="flex items-center justify-between bg-[var(--color-brand-elevated)] p-3">
                <span className="text-sm font-semibold text-[var(--color-brand-text-primary)]">Zakatable wealth</span>
                <span className="font-mono-numbers text-[15px] font-bold text-[var(--color-brand-text-primary)]">{fmtNum(result.zakatable)} EGP</span>
              </div>
            </div>
          </div>

          {/* nisab */}
          <div>
            <p style={micro}>Nisab</p>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <NisabCard title="Silver · 595 g" value={silverNisab} on={nisabBasis === 'silver'} onClick={() => { setNisabBasis('silver'); save({ nisabBasis: 'silver' }) }} />
              <NisabCard title="Gold · 85 g" value={goldNisab} on={nisabBasis === 'gold'} onClick={() => { setNisabBasis('gold'); save({ nisabBasis: 'gold' }) }} />
            </div>
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2.5">
              <BookOpen size={14} className="mt-0.5 shrink-0" style={{ color: '#35D46F' }} />
              <p className="text-[11.5px] leading-relaxed text-[var(--color-brand-text-secondary)]">
                Silver is the recommended basis — it sets the <span className="font-semibold text-[var(--color-brand-text-primary)]">lower threshold</span>, so more of your wealth becomes zakatable and more reaches those in need. The silver price here is estimated from gold.
              </p>
            </div>
          </div>

          {/* stock factor */}
          <div>
            <p style={micro}>How you hold stocks</p>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <FactorCard title="Long-term" sub="30% counted" on={!holdsForTrading} onClick={() => { setHoldsForTrading(false); save({ holdsForTrading: false }) }} />
              <FactorCard title="For trading" sub="100% counted" on={holdsForTrading} onClick={() => { setHoldsForTrading(true); save({ holdsForTrading: true }) }} />
            </div>
          </div>

          {/* override */}
          <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3.5">
            <button type="button" onClick={() => { const v = !manualOn; setManualOn(v); save({ manualAmount: v ? parseFloat(manualAmount) || 0 : null }) }} className="flex w-full items-center justify-between text-left">
              <div><p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">Set the amount myself</p><p className="text-xs text-[var(--color-brand-text-muted)]">Overrides everything above</p></div>
              <span className="relative shrink-0" style={{ width: 46, height: 28, borderRadius: 999, background: manualOn ? '#E50914' : 'var(--color-brand-border)' }}><span className="absolute top-1 h-6 w-6 rounded-full bg-white" style={{ left: manualOn ? 18 : 2, transition: 'left .15s' }} /></span>
            </button>
            {manualOn && (
              <input inputMode="numeric" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} onBlur={() => save({ manualAmount: parseFloat(manualAmount) || 0 })} placeholder="0"
                className="mt-3 h-[52px] w-full rounded-xl bg-[var(--color-brand-card)] px-4 font-mono-numbers text-lg text-[var(--color-brand-text-primary)]" style={{ border: '1px solid rgba(229,9,20,.5)' }} />
            )}
          </div>

          <div className="flex items-start gap-2 rounded-2xl bg-[var(--color-brand-elevated)] p-3.5">
            <BookOpen size={16} className="mt-0.5 shrink-0" style={{ color: '#F5C842' }} />
            <p className="text-xs text-[var(--color-brand-text-secondary)]">Zakat is 2.5% of the wealth you have held for one lunar year above nisab. A home you live in and land you rent out are not counted — only the rent you kept. Buddget follows the majority view; check anything unusual with someone you trust.</p>
          </div>
        </div>

        <div className="flex gap-3 px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[var(--color-brand-border)] py-3.5 text-sm font-semibold text-[var(--color-brand-text-secondary)]">Remind me</button>
          <button type="button" onClick={() => { save({ lastPaidDate: new Date().toISOString() }); onClose() }} className="flex-1 rounded-xl py-3.5 text-sm font-semibold text-white" style={{ background: '#E50914' }}>{result.due ? 'Log zakat payment' : 'Save'}</button>
        </div>
      </div>
    </ModalShell>
  )
}

function NisabCard({ title, value, on, onClick }: { title: string; value: number; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl p-3 text-left" style={{ border: on ? '1px solid rgba(245,200,66,.5)' : '1px solid var(--color-brand-border)', background: on ? 'rgba(245,200,66,.08)' : 'var(--color-brand-elevated)' }}>
      <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{title}</p>
      <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{fmtNum(value)} EGP</p>
    </button>
  )
}

function FactorCard({ title, sub, on, onClick }: { title: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl p-3 text-left" style={{ border: on ? '1px solid rgba(53,212,111,.5)' : '1px solid var(--color-brand-border)', background: on ? 'rgba(53,212,111,.08)' : 'var(--color-brand-elevated)' }}>
      <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{title}</p>
      <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{sub}</p>
    </button>
  )
}
