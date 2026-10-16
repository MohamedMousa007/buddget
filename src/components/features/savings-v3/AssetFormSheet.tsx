'use client'

import { useMemo, useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { ArrowDownLeft, Gem } from 'lucide-react'
import { AmountField } from '@/components/ui/AmountField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useT } from '@/lib/i18n'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAssetPrices } from '@/hooks/useAssetPrices'
import { egyptKaratPrice } from '@/lib/prices/egyptGold'
import { saghaRate, goldToGrams, valueGold, valueCrypto, valueStock, valueProperty, type GoldUnit } from '@/lib/savings/holdingValuation'
import { COINGECKO_IDS } from '@/lib/prices/coingecko'
import { micro } from '@/lib/ui/microLabelStyle'
import type { GoldKarat, InvestmentAssetType } from '@/lib/store/types'
import { SelectableCard } from '@/components/ui/SelectableCard'

const ACCENT: Record<InvestmentAssetType, string> = { gold: 'var(--color-brand-gold)', crypto: 'var(--color-cat-6)', stock: 'var(--color-cat-2)', property: 'var(--color-cat-5)' }
const tint = (color: string, pct: number) => `color-mix(in oklab, ${color} ${pct}%, transparent)`
const UNIT_SUFFIX: Record<GoldUnit, string> = { grams: 'g', pounds: 'pounds', ounces: 'oz' }
const TITLE: Record<InvestmentAssetType, string> = { gold: 'Add gold', crypto: 'Add crypto', stock: 'Add a position', property: 'Add property' }

export interface AssetFormSheetProps {
  open: boolean
  type: InvestmentAssetType
  /** Step back one level (back / X / backdrop). */
  onClose: () => void
  /** Full dismiss after a successful add. Defaults to onClose. */
  onDone?: () => void
}

export function AssetFormSheet({ open, type, onClose, onDone }: AssetFormSheetProps) {
  const t = useT().addHolding
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
    const date = purchaseDate || (source === 'budget' ? new Date().toISOString().slice(0, 10) : undefined)
    const base = { purchaseDate: date, unitCost: paid ? (parseFloat(paid) || 0) / (qty || 1) : undefined, costBasisCurrency: baseCurrency }
    if (type === 'gold') addHolding({ assetType: 'gold', name: `${karat}k gold`, karat, quantity: goldToGrams(qty, goldUnit), goldUnit, currency: 'EGP', ...base })
    else if (type === 'crypto') addHolding({ assetType: 'crypto', name: symbol, symbol, quantity: qty, currency: baseCurrency, ...base })
    else if (type === 'stock') addHolding({ assetType: 'stock', name: symbol.toUpperCase(), symbol: symbol.toUpperCase(), quantity: qty, currency: 'USD', ...base })
    else addHolding({ assetType: 'property', name: 'Property', quantity: parseFloat(size) || 0, propertyValue: parseFloat(propValue) || 0, sharePercent: parseFloat(share) || 100, currency: baseCurrency, ...base })
    ;(onDone ?? onClose)()
  }

  const needsPaid = source === 'budget' && type !== 'property'
  const hasHolding = type === 'property' ? (parseFloat(propValue) || 0) > 0 : qty > 0 && (type !== 'crypto' && type !== 'stock' ? true : !!symbol)
  const canSubmit = hasHolding && (!needsPaid || (parseFloat(paid) || 0) > 0)
  const grams = goldToGrams(qty, goldUnit)

  if (!open) return null

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{TITLE[type]}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{type === 'property' ? `${t.step2} ${t.propertyNote}` : t.step2}</V3SheetHeader.Subtitle>
        </V3SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3 space-y-4">
          {type === 'gold' && (
            <>
              <Field label="Karat">
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar">
                  {([24, 21, 18] as GoldKarat[]).map((k) => {
                    const price = sagha != null && ounceUsd != null ? egyptKaratPrice(ounceUsd, sagha, k) : null
                    const pure = k === 24 ? '999' : k === 21 ? '875' : '750'
                    return (
                      <PriceCard key={k} on={karat === k} onClick={() => setKarat(k)} title={`${k}k`} sub={`${pure} pure${price != null ? ` · ${fmtNum(price)}/g` : ''}`} />
                    )
                  })}
                </div>
              </Field>
              <Field label="Counted as">
                <SegmentedControl<GoldUnit>
                  ariaLabel="Counted as"
                  value={goldUnit}
                  onChange={setGoldUnit}
                  options={[{ value: 'grams', label: 'Grams' }, { value: 'pounds', label: 'Gold pounds' }, { value: 'ounces', label: 'Ounces' }]}
                />
              </Field>
              <Field label="How much">
                <UnitField value={amount} onChange={setAmount} suffix={UNIT_SUFFIX[goldUnit]} label="How much" />
                {goldUnit !== 'grams' && qty > 0 && (
                  <p className="mt-2 font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">
                    = {fmtNum(grams)} g. Your row will say &ldquo;{qty} {UNIT_SUFFIX[goldUnit]}&rdquo;.
                  </p>
                )}
              </Field>
            </>
          )}

          {type === 'crypto' && (
            <>
              <Field label="Coin">
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar">
                  {Object.keys(COINGECKO_IDS).map((c) => {
                    const p = lookup(c, 'USD')?.price ?? null
                    return <PriceCard key={c} on={symbol === c} onClick={() => setSymbol(c)} title={c} sub={p != null ? `$${fmtNum(p)}` : 'live price'} />
                  })}
                  <PriceCard on={!['BTC', 'ETH'].includes(symbol)} onClick={() => setSymbol('')} title="Other" sub="type it" />
                </div>
              </Field>
              {!['BTC', 'ETH'].includes(symbol) && <Field label="Symbol"><Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="SOL" size="brand" className="font-mono-numbers" /></Field>}
              <Field label="How much"><UnitField value={amount} onChange={setAmount} suffix={symbol || 'coins'} label="How much" /></Field>
            </>
          )}

          {type === 'stock' && (
            <>
              <Field label="Ticker"><Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" size="brand" className="font-mono-numbers" /></Field>
              <Field label="Shares"><UnitField value={amount} onChange={setAmount} suffix="shares" label="Shares" /></Field>
            </>
          )}

          {type === 'property' && (
            <>
              <Field label={t.propertyWorth}><UnitField value={propValue} onChange={setPropValue} suffix={baseCurrency} label={t.propertyWorth} /></Field>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
                <Field label="Size"><UnitField value={size} onChange={setSize} suffix="m²" label="Size" compact /></Field>
                <Field label="Your share"><UnitField value={share} onChange={setShare} suffix="%" label="Your share" compact /></Field>
              </div>
            </>
          )}

          {type !== 'property' && (
            <div>
              <div
                className="rounded-2xl border p-4"
                style={{ borderColor: tint(accent, 40), background: tint(accent, 8) }}
              >
                <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{type === 'gold' ? 'What a shop would pay you today' : 'What it is worth today'}</p>
                <p className="mt-1 font-mono-numbers text-2xl font-bold" style={{ color: accent }}>{liveValue != null ? `${fmtNum(liveValue)} EGP` : '—'}</p>
                <p className="mt-1 font-mono-numbers text-[11px] text-[var(--color-brand-text-muted)]">{liveValue != null ? 'Live valuation' : 'Live price refreshing — value will appear shortly'}</p>
              </div>
            </div>
          )}

          <Field label="Where did the money come from?">
            <div className="space-y-2.5" role="radiogroup" aria-label="Where did the money come from?">
              <SelectableCard selected={source === 'budget'} onClick={() => setSource('budget')}>
                <SourceIcon><ArrowDownLeft size={18} /></SourceIcon>
                <SourceText title={t.boughtThisMonth} sub={t.boughtThisMonthSub} />
              </SelectableCard>
              <SelectableCard selected={source === 'had'} onClick={() => setSource('had')}>
                <SourceIcon><Gem size={18} /></SourceIcon>
                <SourceText title={t.alreadyHad} sub={t.alreadyHadSub} />
              </SelectableCard>
            </div>
          </Field>

          {type !== 'property' && source === 'had' && (
            <Field label={`${t.whenBought} · ${t.optional}`}>
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} size="brand" />
            </Field>
          )}
          {type !== 'property' && (
            <Field label={source === 'had' ? `${t.whatYouPaid} · ${t.optional}` : t.whatYouPaid}>
              <UnitField value={paid} onChange={setPaid} suffix={type === 'stock' ? 'USD' : 'EGP'} label={t.whatYouPaid} placeholder="Total" />
              {source === 'had' && <p className="mt-2 text-xs text-[var(--color-brand-text-muted)]">{t.paidHint}</p>}
            </Field>
          )}
        </div>

        <div className="px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <Button size="cta-block" onClick={submit} disabled={!canSubmit} className="font-semibold">
            {type === 'gold' && qty > 0 ? `Add ${qty} ${UNIT_SUFFIX[goldUnit]} of ${karat}k` : 'Add investment'}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={micro}>{label}</label><div className="mt-2">{children}</div></div>
}

function PriceCard({ on, onClick, title, sub }: { on: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <SelectableCard layout="stack" selected={on} onClick={onClick} className="w-auto shrink-0 gap-0 px-3 py-2.5" style={{ minWidth: 88 }}>
      <p className="font-mono-numbers text-[15px] font-bold" style={{ color: 'var(--color-brand-gold)' }}>{title}</p>
      <p className="font-mono-numbers text-[10px] text-[var(--color-brand-text-muted)]">{sub}</p>
    </SelectableCard>
  )
}

/** AmountField has no unit slot, so the unit rides over the field's inline-end edge. */
function UnitField({ value, onChange, suffix, label, placeholder, compact }: { value: string; onChange: (v: string) => void; suffix: string; label: string; placeholder?: string; compact?: boolean }) {
  return (
    <div className="relative">
      <AmountField value={value} onChange={onChange} label={label} placeholder={placeholder ?? '0'} size={compact ? 'compact' : 'default'} />
      <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 font-mono-numbers text-sm text-[var(--color-brand-text-muted)]">{suffix}</span>
    </div>
  )
}

function SourceIcon({ children }: { children: React.ReactNode }) {
  return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)]">{children}</span>
}

function SourceText({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{title}</p>
      <p className="text-xs text-[var(--color-brand-text-muted)]">{sub}</p>
    </div>
  )
}
