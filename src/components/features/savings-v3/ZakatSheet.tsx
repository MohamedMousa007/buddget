'use client'

import { useMemo, useState } from 'react'
import { Wallet, Gem, Bitcoin, TrendingUp, Home, CreditCard, BookOpen, Calendar } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { computeZakat } from '@/lib/savings/zakat'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { cn } from '@/lib/utils'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { micro } from '@/lib/ui/microLabelStyle'
import type { ZakatBase } from '@/lib/savings/zakatInputs'
import type { ZakatConfig } from '@/lib/store/types'
import { Switch } from '@/components/ui/switch'
import { FieldButton } from '@/components/ui/FieldButton'
import { OptionChip } from '@/components/ui/OptionChip'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { UnifiedDatePicker, formatDatePillLabel } from '@/components/ui/UnifiedDatePicker'
import { tint } from '@/components/features/savings-v3/MoneySheetParts'
import { effectiveNisabBasis, zakatBasisChosen } from '@/lib/savings/zakatBasis'
import { useLocale, useT } from '@/lib/i18n'

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
  const t = useT().wealthSheets.zakat
  const { locale } = useLocale()
  const todayLabel = useT().expenseForm.today

  const [nisabBasis, setNisabBasis] = useState<'silver' | 'gold'>(effectiveNisabBasis(cfg))
  const [basisChosen, setBasisChosen] = useState(zakatBasisChosen(cfg))
  const [yearPickerOpen, setYearPickerOpen] = useState(false)
  const [holdsForTrading, setHoldsForTrading] = useState(cfg?.holdsForTrading ?? false)
  const [manualOn, setManualOn] = useState(cfg?.manualAmount != null)
  const [yearStart, setYearStart] = useState(cfg?.yearStartDate ?? '')
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

  const save = (patch: Partial<ZakatConfig>) => updateProfile({ zakatConfig: { nisabBasis, nisabBasisChosen: basisChosen, holdsForTrading, manualAmount: manualOn ? parseFloat(manualAmount) || 0 : null, lineOverrides: overrides, yearStartDate: yearStart || null, ...patch } })
  const editLine = (id: LineId, raw: string) => {
    const next = { ...overrides }
    if (raw.trim() === '') delete next[id]
    else next[id] = parseFloat(raw.replace(/,/g, '')) || 0
    setOverrides(next); save({ lineOverrides: next })
  }

  const todayIso = new Date().toISOString().slice(0, 10)
  const janIso = `${todayIso.slice(0, 4)}-01-01`
  const pickYear = (v: string) => { setYearStart(v); save({ yearStartDate: v || null }) }

  const silverNisab = 595 * base.silverPerGram
  const goldNisab = 85 * base.gold24kSellPerGram
  const accent = result.due ? 'var(--color-brand-gold)' : 'var(--color-brand-green)'

  if (!open) return null

  const rows: Array<{ id: LineId; icon: React.ReactNode; color: string; name: string; sub: string; value: number; negative?: boolean }> = [
    { id: 'cash', icon: <Wallet size={18} />, color: 'var(--color-cat-5)', name: 'Cash & savings', sub: 'Every pocket you hold', value: cash },
    { id: 'gold', icon: <Gem size={18} />, color: 'var(--color-brand-gold)', name: 'Gold', sub: "At today's sell price", value: gold },
    { id: 'crypto', icon: <Bitcoin size={18} />, color: 'var(--color-cat-6)', name: 'Crypto', sub: 'Treated like cash', value: crypto },
    { id: 'stocks', icon: <TrendingUp size={18} />, color: 'var(--color-brand-green)', name: 'Stocks', sub: `${holdsForTrading ? 'For trading · 100%' : 'Long-term · 30%'} counted`, value: stocks },
  ]

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>Zakat</V3SheetHeader.Title>
        </V3SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3 space-y-4">
          {/* verdict */}
          <div className="relative overflow-hidden rounded-2xl border p-4" style={{ borderColor: tint(accent, 35), background: tint(accent, 6) }}>
            <p className="text-sm font-semibold" style={{ color: accent }}>{result.due ? 'Zakat is due' : 'No zakat due'}</p>
            <p className="mt-1 font-mono-numbers text-[30px] font-bold text-[var(--color-brand-text-primary)]">{result.due ? fmtNum(result.zakat) : '—'} <span className="text-base text-[var(--color-brand-text-muted)]">EGP</span></p>
            <p className="mt-1 font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{result.due ? `2.5% × ${fmtNum(result.zakatable)} EGP zakatable` : `You are ${fmtNum(result.gap)} EGP under the line`}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--color-brand-sunken)' }}><div style={{ width: `${Math.min(100, result.nisab > 0 ? (result.zakatable / result.nisab) * 100 : 0)}%`, height: '100%', background: accent }} /></div>
            <div className="mt-2 flex justify-between font-mono-numbers text-[11px] text-[var(--color-brand-text-muted)]"><span>Nisab · {fmtNum(result.nisab)} EGP</span><span>Hawl ends {hawlDate}</span></div>
          </div>

          {/* what counts */}
          <div>
            <p style={micro}>What counts</p>
            <Card padding="none" className="mt-2 overflow-hidden">
              {rows.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 p-3" style={{ borderTop: i ? '1px solid var(--color-brand-border)' : undefined }}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: tint(r.color, 14), color: r.color }}>{r.icon}</span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{r.name}</p><p className="text-[11px] text-[var(--color-brand-text-muted)]">{r.sub}</p></div>
                  {/* Deliberately compact (36px) so the row rhythm holds — not the app's 48px field. */}
                  <input inputMode="numeric" defaultValue={fmtNum(r.value)} onBlur={(e) => editLine(r.id, e.target.value)}
                    className={cn(
                      'h-9 w-[84px] rounded-[11px] border bg-[var(--color-brand-elevated)] px-2 text-right font-mono-numbers text-sm text-[var(--color-brand-text-primary)] outline-none',
                      overrides[r.id] != null ? 'border-[var(--color-brand-primary)]/50' : 'border-transparent',
                    )} />
                </div>
              ))}
              {/* property */}
              <div className="flex items-center gap-3 p-3" style={{ borderTop: '1px solid var(--color-brand-border)' }}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: tint('var(--color-cat-1)', 14), color: 'var(--color-cat-1)' }}><Home size={18} /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">Property</p><p className="text-[11px] text-[var(--color-brand-text-muted)]">Not counted — only rent you kept</p></div>
                <span className="rounded-full border border-dashed border-[var(--color-brand-border)] px-3 py-1.5 text-[11px] text-[var(--color-brand-text-muted)]">Not counted</span>
              </div>
              {/* debts (negative) */}
              <div className="flex items-center gap-3 p-3" style={{ borderTop: '1px solid var(--color-brand-border)' }}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: tint('var(--color-brand-red)', 14), color: 'var(--color-brand-red)' }}><CreditCard size={18} /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">Debts due this year</p><p className="text-[11px] text-[var(--color-brand-text-muted)]">Subtracted from your wealth</p></div>
                <span className="mr-1 text-sm text-[var(--color-brand-red)]">−</span>
                <input inputMode="numeric" defaultValue={fmtNum(debts)} onBlur={(e) => editLine('debts', e.target.value)}
                  className={cn(
                    'h-9 w-[76px] rounded-[11px] border bg-[var(--color-brand-elevated)] px-2 text-right font-mono-numbers text-sm text-[var(--color-brand-red)] outline-none',
                    overrides.debts != null ? 'border-[var(--color-brand-primary)]/50' : 'border-transparent',
                  )} />
              </div>
              <div className="flex items-center justify-between bg-[var(--color-brand-elevated)] p-3">
                <span className="text-sm font-semibold text-[var(--color-brand-text-primary)]">Zakatable wealth</span>
                <span className="font-mono-numbers text-[15px] font-bold text-[var(--color-brand-text-primary)]">{fmtNum(result.zakatable)} EGP</span>
              </div>
            </Card>
          </div>

          {/* nisab basis */}
          <div>
            <p style={micro}>{t.basis}</p>
            <SegmentedControl
              className="mt-2"
              ariaLabel={t.basisAria}
              value={nisabBasis}
              onChange={(v) => { setNisabBasis(v); setBasisChosen(true); save({ nisabBasis: v, nisabBasisChosen: true }) }}
              options={[
                { value: 'silver', label: `${t.silver} \u00b7 595 g` },
                { value: 'gold', label: `${t.gold} \u00b7 85 g` },
              ]}
            />
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2.5">
              <BookOpen size={14} className="mt-0.5 shrink-0 text-[var(--color-brand-green)]" />
              <p className="font-mono-numbers text-[11.5px] leading-relaxed text-[var(--color-brand-text-secondary)]">
                {t.silver} ≈ {fmtNum(silverNisab)} · {t.gold} {fmtNum(goldNisab)} EGP. {t.silverEstimate}
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

          {/* zakat year — the hawl anchor. Without this the due date is derived from the
              account's creation, which is when they installed the app and means nothing
              religiously. See lib/savings/hawl.ts. */}
          <Card variant="elevated" padding="none" className="p-3.5">
            <p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{t.yearStart}</p>
            <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">{yearStart ? t.yearSet : t.yearNotSet}</p>
            <FieldButton
              className="mt-3"
              icon={<Calendar className="size-4 text-[var(--color-brand-text-muted)]" />}
              value={yearStart ? formatDatePillLabel(yearStart, locale, todayLabel) : undefined}
              placeholder={t.pickDate}
              affordance={null}
              onClick={() => setYearPickerOpen(true)}
            />
            <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
              <OptionChip selected={yearStart === todayIso} onClick={() => pickYear(todayIso)}>{t.today}</OptionChip>
              <OptionChip selected={yearStart === janIso} onClick={() => pickYear(janIso)}>{t.startOfYear}</OptionChip>
            </div>
            <UnifiedDatePicker open={yearPickerOpen} value={yearStart} onConfirm={pickYear} onClose={() => setYearPickerOpen(false)} />
          </Card>

          {/* override */}
          <Card variant="elevated" padding="none" className="p-3.5">
            <div className="flex w-full items-center justify-between text-left">
              <div><p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{t.override}</p><p className="text-xs text-[var(--color-brand-text-muted)]">{t.overrideHint}</p></div>
              <Switch
                size="touch"
                aria-label={t.override}
                checked={manualOn}
                onCheckedChange={(v) => { setManualOn(v); save({ manualAmount: v ? parseFloat(manualAmount) || 0 : null }) }}
              />
            </div>
            {manualOn && (
              <Input inputMode="numeric" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} onBlur={() => save({ manualAmount: parseFloat(manualAmount) || 0 })} placeholder="0"
                className="mt-3 h-12 rounded-xl border-[var(--color-brand-primary)]/50 bg-[var(--color-brand-card)] px-4 font-mono-numbers text-lg text-[var(--color-brand-text-primary)]" />
            )}
          </Card>

          <div className="flex items-start gap-2 rounded-2xl bg-[var(--color-brand-elevated)] p-3.5">
            <BookOpen size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-brand-gold)' }} />
            <p className="text-xs text-[var(--color-brand-text-secondary)]">Zakat is 2.5% of the wealth you have held for one lunar year above nisab. A home you live in and land you rent out are not counted — only the rent you kept. Buddget follows the majority view; check anything unusual with someone you trust.</p>
          </div>
        </div>

        <div className="flex gap-3 px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <Button variant="outline" size="cta" onClick={onClose} className="flex-1 text-sm font-semibold">Remind me</Button>
          <Button size="cta" onClick={() => { save({ lastPaidDate: new Date().toISOString() }); onClose() }} className="flex-1 text-sm font-semibold">{result.due ? 'Log zakat payment' : 'Save'}</Button>
        </div>
      </div>
    </ModalShell>
  )
}

function FactorCard({ title, sub, on, onClick }: { title: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <SelectableCard layout="stack" selected={on} onClick={onClick}>
      <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{title}</p>
      <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{sub}</p>
    </SelectableCard>
  )
}
