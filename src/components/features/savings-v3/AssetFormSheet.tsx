'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Input } from '@/components/ui/input'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAssetPrices } from '@/hooks/useAssetPrices'
import { egyptKaratPrice } from '@/lib/prices/egyptGold'
import { saghaRate, goldToGrams, valueGold, valueCrypto, valueStock, valueProperty, type GoldUnit } from '@/lib/savings/holdingValuation'
import { COINGECKO_IDS } from '@/lib/prices/coingecko'
import type { GoldKarat, InvestmentAssetType } from '@/lib/store/types'

const micro: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-brand-text-muted)' }
const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US')
const hexToRgb = (hex: string) => { const h = hex.replace('#', ''); return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}` }

const ACCENT: Record<InvestmentAssetType, string> = { gold: '#F5C842', crypto: '#B79CFF', stock: '#35D46F', property: '#2CE0C6' }
const TITLE: Record<InvestmentAssetType, string> = { gold: 'Add gold', crypto: 'Add crypto', stock: 'Add a position', property: 'Add property' }

export interface AssetFormSheetProps {
  open: boolean
  type: InvestmentAssetType
  onClose: () => void
}

export function AssetFormSheet({ open, type, onClose }: AssetFormSheetProps) {
  const addHolding = useFinanceStore((s) => s.addInvestmentHolding)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const { lookup } = useAssetPrices()
  const accent = ACCENT[type]

  // shared
  const [amount, setAmount] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [paid, setPaid] = useState('')
  const [source, setSource] = useState<'budget' | 'had'>('budget')
  // gold
  const [karat, setKarat] = useState<GoldKarat>(21)
  const [goldUnit, setGoldUnit] = useState<GoldUnit>('grams')
  const [where, setWhere] = useState('Home')
  // crypto / stock
  const [symbol, setSymbol] = useState(type === 'crypto' ? 'BTC' : '')
  // property
  const [propValue, setPropValue] = useState('')
  const [size, setSize] = useState('')
  const [share, setShare] = useState('100')

  const qty = parseFloat(amount) || 0
  const sagha = saghaRate(lookup)
  const ounceUsd = lookup('XAU', 'USD')?.price ?? null

  const liveValue = useMemo(() => {
    if (type === 'gold') return valueGold(goldToGrams(qty, goldUnit), karat, lookup, 'EGP').value
    if (type === 'crypto') return valueCrypto(qty, symbol, lookup, sagha).value
    if (type === 'stock') return valueStock(qty, symbol.toUpperCase(), lookup, sagha).value
    return valueProperty(parseFloat(propValue) || 0).value
  }, [type, qty, goldUnit, karat, symbol, propValue, lookup, sagha])

  const submit = () => {
    const base = { purchaseDate: purchaseDate || undefined, unitCost: paid ? (parseFloat(paid) || 0) / (qty || 1) : undefined, costBasisCurrency: baseCurrency }
    if (type === 'gold') addHolding({ assetType: 'gold', name: `${karat}k gold`, karat, quantity: goldToGrams(qty, goldUnit), goldUnit, currency: 'EGP', location: where, ...base })
    else if (type === 'crypto') addHolding({ assetType: 'crypto', name: symbol, symbol, quantity: qty, currency: baseCurrency, ...base })
    else if (type === 'stock') addHolding({ assetType: 'stock', name: symbol.toUpperCase(), symbol: symbol.toUpperCase(), quantity: qty, currency: 'USD', ...base })
    else addHolding({ assetType: 'property', name: 'Property', quantity: parseFloat(size) || 0, propertyValue: parseFloat(propValue) || 0, sharePercent: parseFloat(share) || 100, currency: baseCurrency, ...base })
    onClose()
  }

  const canSubmit = type === 'property' ? (parseFloat(propValue) || 0) > 0 : qty > 0 && (type !== 'crypto' && type !== 'stock' ? true : !!symbol)

  if (!open) return null

  return (
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="flex flex-col" style={{ maxHeight: '92vh' }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-[22px] font-bold text-[var(--color-brand-text-primary)]">{TITLE[type]}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-4">
          {type === 'gold' && (
            <>
              <Field label="Karat">
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar">
                  {([24, 21, 18] as GoldKarat[]).map((k) => {
                    const price = sagha != null && ounceUsd != null ? egyptKaratPrice(ounceUsd, sagha, k) : null
                    const pure = k === 24 ? '999' : k === 21 ? '875' : '750'
                    return (
                      <PriceCard key={k} on={karat === k} accent={accent} onClick={() => setKarat(k)} title={`${k}k`} sub={`${pure} pure${price != null ? ` · ${fmtNum(price)}/g` : ''}`} />
                    )
                  })}
                </div>
              </Field>
              <Field label="Counted as">
                <ChipRow options={['grams', 'pounds', 'ounces']} value={goldUnit} onChange={(v) => setGoldUnit(v as GoldUnit)} labels={{ grams: 'Grams', pounds: 'Gold pounds', ounces: 'Ounces' }} />
              </Field>
              <Field label="How much"><UnitInput value={amount} onChange={setAmount} suffix={goldUnit === 'grams' ? 'g' : goldUnit === 'pounds' ? 'pounds' : 'oz'} /></Field>
              <Field label="Where it is"><ChipRow options={['Home', 'Bank locker', 'Jeweller', 'Elsewhere']} value={where} onChange={setWhere} /></Field>
            </>
          )}

          {type === 'crypto' && (
            <>
              <Field label="Coin">
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar">
                  {Object.keys(COINGECKO_IDS).map((c) => {
                    const p = lookup(c, 'USD')?.price ?? null
                    return <PriceCard key={c} on={symbol === c} accent={accent} onClick={() => setSymbol(c)} title={c} sub={p != null ? `$${fmtNum(p)}` : 'live price'} />
                  })}
                  <PriceCard on={!['BTC', 'ETH'].includes(symbol)} accent={accent} onClick={() => setSymbol('')} title="Other" sub="type it" />
                </div>
              </Field>
              {!['BTC', 'ETH'].includes(symbol) && <Field label="Symbol"><Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="SOL" className="h-12 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] font-mono-numbers" /></Field>}
              <Field label="How much"><UnitInput value={amount} onChange={setAmount} suffix={symbol || 'coins'} /></Field>
            </>
          )}

          {type === 'stock' && (
            <>
              <Field label="Ticker"><Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" className="h-12 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] font-mono-numbers" /></Field>
              <Field label="Shares"><UnitInput value={amount} onChange={setAmount} suffix="shares" /></Field>
            </>
          )}

          {type === 'property' && (
            <>
              <Field label="Estimated value"><UnitInput value={propValue} onChange={setPropValue} suffix="EGP" /></Field>
              <Field label="Size"><UnitInput value={size} onChange={setSize} suffix="m²" /></Field>
              <Field label="Your share"><UnitInput value={share} onChange={setShare} suffix="%" /></Field>
            </>
          )}

          <Field label="When you bought it"><Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="h-12 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]" /></Field>
          {type !== 'property' && <Field label="What you paid · optional"><UnitInput value={paid} onChange={setPaid} suffix={type === 'stock' ? 'USD' : 'EGP'} placeholder="Total" /></Field>}

          {/* live value */}
          <div className="rounded-2xl border p-4" style={{ borderColor: `rgba(${hexToRgb(accent)},.4)`, background: `rgba(${hexToRgb(accent)},.06)` }}>
            <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{type === 'gold' ? 'What a shop would pay you today' : 'What it is worth today'}</p>
            <p className="mt-1 font-mono-numbers text-2xl font-bold" style={{ color: accent }}>{liveValue != null ? `${fmtNum(liveValue)} EGP` : '—'}</p>
            <p className="mt-1 font-mono-numbers text-[11px] text-[var(--color-brand-text-muted)]">{liveValue != null ? 'Live valuation' : 'Live price refreshing — value will appear shortly'}</p>
          </div>

          <Field label="Where did the money come from?">
            <div className="grid grid-cols-2 gap-2.5">
              <SourceChip title="This month" on={source === 'budget'} onClick={() => setSource('budget')} />
              <SourceChip title="Already had it" on={source === 'had'} onClick={() => setSource('had')} />
            </div>
          </Field>
        </div>

        <div className="px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={submit} disabled={!canSubmit} className="w-full text-white"
            style={{ height: 52, borderRadius: 14, fontWeight: 600, fontSize: 15, background: canSubmit ? '#E50914' : 'var(--color-brand-elevated)', color: canSubmit ? '#fff' : 'var(--color-brand-text-muted)', cursor: canSubmit ? 'pointer' : 'default' }}>
            Add investment
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={micro}>{label}</label><div className="mt-2">{children}</div></div>
}

function PriceCard({ on, accent, onClick, title, sub }: { on: boolean; accent: string; onClick: () => void; title: string; sub: string }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 rounded-[14px] px-3 py-2.5 text-left" style={{ minWidth: 88, border: on ? `1px solid rgba(${hexToRgb(accent)},.5)` : '1px solid var(--color-brand-border)', background: on ? `rgba(${hexToRgb(accent)},.10)` : 'var(--color-brand-elevated)' }}>
      <p className="font-mono-numbers text-[15px] font-bold text-[var(--color-brand-text-primary)]">{title}</p>
      <p className="font-mono-numbers text-[10px] text-[var(--color-brand-text-muted)]">{sub}</p>
    </button>
  )
}

function ChipRow({ options, value, onChange, labels }: { options: string[]; value: string; onChange: (v: string) => void; labels?: Record<string, string> }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)} className="shrink-0 rounded-full px-4 text-[12.5px] font-semibold" style={{ height: 36, border: value === o ? '1px solid rgba(229,9,20,.45)' : '1px solid var(--color-brand-border)', background: value === o ? 'rgba(229,9,20,.13)' : 'transparent', color: 'var(--color-brand-text-primary)' }}>
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  )
}

function UnitInput({ value, onChange, suffix, placeholder }: { value: string; onChange: (v: string) => void; suffix: string; placeholder?: string }) {
  return (
    <div className="flex items-center rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4" style={{ height: 50 }}>
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? '0'} className="flex-1 bg-transparent font-mono-numbers text-base font-semibold text-[var(--color-brand-text-primary)] outline-none" />
      <span className="font-mono-numbers text-sm text-[var(--color-brand-text-muted)]">{suffix}</span>
    </div>
  )
}

function SourceChip({ title, on, onClick }: { title: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl p-3.5 text-center text-[13px] font-semibold" style={{ border: on ? '1px solid rgba(229,9,20,.5)' : '1px solid var(--color-brand-border)', background: on ? 'rgba(229,9,20,.06)' : 'var(--color-brand-elevated)', color: 'var(--color-brand-text-primary)' }}>{title}</button>
  )
}
