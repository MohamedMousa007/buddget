'use client'

import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { formatCurrency } from '@/lib/utils/formatters'
import { convertCurrency } from '@/lib/utils/currency'
import { totalSavingsHoldingsInBase } from '@/lib/utils/calculations'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2 } from 'lucide-react'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type { Currency, SavingsBucket, SavingsHolding, SavingsSubtype } from '@/lib/store/types'
import { useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n'

const SUBTYPE_KEYS: Record<SavingsSubtype, keyof Dictionary['savings']> = {
  bank: 'subtypeBank',
  cash: 'subtypeCash',
  gold: 'subtypeGold',
  stocks: 'subtypeStocks',
  crypto: 'subtypeCrypto',
  real_estate: 'subtypeRealEstate',
  other: 'subtypeOther',
}

function SavingsHoldingRow({
  holding,
  baseCurrency,
  exchangeRates,
  onDelete,
  savings,
}: {
  holding: SavingsHolding
  baseCurrency: Currency
  exchangeRates: Record<string, number>
  onDelete: (id: string) => void
  savings: Dictionary['savings']
}) {
  const { id, name: n, bucket: b, subtype: st, amount: a, currency: c } = holding
  const inBase = convertCurrency(a, c, baseCurrency, exchangeRates)
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--color-brand-border)] last:border-0 gap-2">
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{n}</p>
        <p className="text-[10px] text-[var(--color-brand-text-muted)] uppercase">
          {b === 'liquid' ? savings.bucketLiquid : savings.bucketInvestment} · {savings[SUBTYPE_KEYS[st]] as string}
        </p>
      </div>
      <div className="text-end shrink-0 flex items-center gap-2">
        <div>
          <p className="text-sm font-mono-numbers text-white">{formatCurrency(a, c)}</p>
          <p className="text-[10px] text-[var(--color-brand-text-muted)] font-mono-numbers">
            ≈ {formatCurrency(inBase, baseCurrency)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(savings.confirmDelete)) onDelete(id)
          }}
          className="p-1.5 rounded-lg hover:bg-red-900/30"
          aria-label="Delete"
        >
          <Trash2 className="w-4 h-4 text-[var(--color-brand-red)]" />
        </button>
      </div>
    </div>
  )
}

export default function SavingsPage() {
  const {
    savingsHoldings,
    addSavingsHolding,
    deleteSavingsHolding,
    settings,
    exchangeRates,
  } = useFinanceStore(
    useShallow((s) => ({
      savingsHoldings: s.savingsHoldings,
      addSavingsHolding: s.addSavingsHolding,
      deleteSavingsHolding: s.deleteSavingsHolding,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
    }))
  )

  const [name, setName] = useState('')
  const [bucket, setBucket] = useState<SavingsBucket>('liquid')
  const [subtype, setSubtype] = useState<SavingsSubtype>('bank')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency)

  const totalBase = totalSavingsHoldingsInBase(savingsHoldings, settings.baseCurrency, exchangeRates)

  const liquid = savingsHoldings.filter((h) => h.bucket === 'liquid')
  const inv = savingsHoldings.filter((h) => h.bucket === 'investment')
  const requireAuth = useRequireAuthAction()
  const t = useT()

  const handleAdd = () => {
    if (!name.trim() || !amount || parseFloat(amount) <= 0) return
    requireAuth(() => {
      addSavingsHolding({
        name: name.trim(),
        bucket,
        subtype,
        amount: parseFloat(amount),
        currency: clampFiatToAllowed(settings, currency),
      })
      setName('')
      setAmount('')
      setCurrency(settings.baseCurrency)
    }, t.savings.requireAuth)
  }

  return (
    <div className="min-h-screen pb-24">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-white">{t.savings.pageTitle}</h1>
          <p className="text-xs text-[var(--color-brand-text-muted)] mt-1">
            {t.savings.totalLine(settings.baseCurrency)}
            <span className="font-mono-numbers text-[var(--color-brand-green)]">{formatCurrency(totalBase, settings.baseCurrency)}</span>
          </p>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-6">
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">{t.savings.addTitle}</h2>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelName}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.savings.placeholderName} className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelKind}</Label>
              <select
                value={bucket}
                onChange={(e) => setBucket(e.target.value as SavingsBucket)}
                className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
              >
                <option value="liquid">{t.savings.optionLiquid}</option>
                <option value="investment">{t.savings.optionInvestment}</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelType}</Label>
              <select
                value={subtype}
                onChange={(e) => setSubtype(e.target.value as SavingsSubtype)}
                className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
              >
                {(Object.keys(SUBTYPE_KEYS) as SavingsSubtype[]).map((s) => (
                  <option key={s} value={s}>{t.savings[SUBTYPE_KEYS[s]] as string}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelCurrentAmount}</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers" />
            </div>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelCurrency}</Label>
              <FiatCurrencySelect
                value={currency}
                onChange={setCurrency}
                className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="w-full py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold"
          >
            {t.savings.buttonAdd}
          </button>
        </section>

        <section className="glass-card rounded-2xl p-5">
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-3">{t.savings.sectionLiquid}</h2>
          {liquid.length === 0 ? (
            <p className="text-sm text-[var(--color-brand-text-muted)] py-4 text-center">{t.savings.emptyLiquid}</p>
          ) : (
            liquid.map((h) => (
              <SavingsHoldingRow
                key={h.id}
                holding={h}
                baseCurrency={settings.baseCurrency}
                exchangeRates={exchangeRates}
                onDelete={deleteSavingsHolding}
                savings={t.savings}
              />
            ))
          )}
        </section>

        <section className="glass-card rounded-2xl p-5">
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-3">{t.savings.sectionInvestment}</h2>
          {inv.length === 0 ? (
            <p className="text-sm text-[var(--color-brand-text-muted)] py-4 text-center">{t.savings.emptyInvestment}</p>
          ) : (
            inv.map((h) => (
              <SavingsHoldingRow
                key={h.id}
                holding={h}
                baseCurrency={settings.baseCurrency}
                exchangeRates={exchangeRates}
                onDelete={deleteSavingsHolding}
                savings={t.savings}
              />
            ))
          )}
        </section>
      </div>
    </div>
  )
}
