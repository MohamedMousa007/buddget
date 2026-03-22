'use client'

import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { formatCurrency } from '@/lib/utils/formatters'
import { convertCurrency } from '@/lib/utils/currency'
import { totalSavingsHoldingsInBase } from '@/lib/utils/calculations'
import { QuickAddFAB } from '@/components/modals/QuickAddFAB'
import { useRequireAuthAction } from '@/lib/hooks/useRequireAuthAction'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2 } from 'lucide-react'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import type { Currency, SavingsBucket, SavingsHolding, SavingsSubtype } from '@/lib/store/types'

const SUBTYPES: { value: SavingsSubtype; label: string }[] = [
  { value: 'bank', label: 'Bank account' },
  { value: 'cash', label: 'Cash' },
  { value: 'gold', label: 'Gold / bullion' },
  { value: 'stocks', label: 'Stocks / funds' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'real_estate', label: 'Real estate' },
  { value: 'other', label: 'Other' },
]

function SavingsHoldingRow({
  holding,
  baseCurrency,
  exchangeRates,
  onDelete,
}: {
  holding: SavingsHolding
  baseCurrency: Currency
  exchangeRates: Record<string, number>
  onDelete: (id: string) => void
}) {
  const { id, name: n, bucket: b, subtype: st, amount: a, currency: c } = holding
  const inBase = convertCurrency(a, c, baseCurrency, exchangeRates)
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--color-brand-border)] last:border-0 gap-2">
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{n}</p>
        <p className="text-[10px] text-[var(--color-brand-text-muted)] uppercase">
          {b === 'liquid' ? 'Liquid' : 'Investment'} · {SUBTYPES.find((s) => s.value === st)?.label ?? st}
        </p>
      </div>
      <div className="text-right shrink-0 flex items-center gap-2">
        <div>
          <p className="text-sm font-mono-numbers text-white">{formatCurrency(a, c)}</p>
          <p className="text-[10px] text-[var(--color-brand-text-muted)] font-mono-numbers">
            ≈ {formatCurrency(inBase, baseCurrency)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Remove this holding from your savings list?')) onDelete(id)
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

  const handleAdd = () => {
    if (!name.trim() || !amount || parseFloat(amount) <= 0) return
    requireAuth(() => {
      addSavingsHolding({
        name: name.trim(),
        bucket,
        subtype,
        amount: parseFloat(amount),
        currency,
      })
      setName('')
      setAmount('')
      setCurrency(settings.baseCurrency)
    }, 'Sign in or create an account to add savings holdings.')
  }

  return (
    <div className="min-h-screen pb-24">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-white">Savings</h1>
          <p className="text-xs text-[var(--color-brand-text-muted)] mt-1">
            Total in {settings.baseCurrency}:{' '}
            <span className="font-mono-numbers text-[var(--color-brand-green)]">{formatCurrency(totalBase, settings.baseCurrency)}</span>
          </p>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-6">
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">Add holding</h2>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emirates NBD savings" className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Category</Label>
              <select
                value={bucket}
                onChange={(e) => setBucket(e.target.value as SavingsBucket)}
                className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
              >
                <option value="liquid">Liquid savings</option>
                <option value="investment">Investments</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Type</Label>
              <select
                value={subtype}
                onChange={(e) => setSubtype(e.target.value as SavingsSubtype)}
                className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
              >
                {SUBTYPES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Amount</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers" />
            </div>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Currency</Label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm">
                {FIAT_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="w-full py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold"
          >
            Add holding
          </button>
        </section>

        <section className="glass-card rounded-2xl p-5">
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-3">Liquid savings</h2>
          {liquid.length === 0 ? (
            <p className="text-sm text-[var(--color-brand-text-muted)] py-4 text-center">No liquid holdings yet</p>
          ) : (
            liquid.map((h) => (
              <SavingsHoldingRow
                key={h.id}
                holding={h}
                baseCurrency={settings.baseCurrency}
                exchangeRates={exchangeRates}
                onDelete={deleteSavingsHolding}
              />
            ))
          )}
        </section>

        <section className="glass-card rounded-2xl p-5">
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-3">Investments</h2>
          {inv.length === 0 ? (
            <p className="text-sm text-[var(--color-brand-text-muted)] py-4 text-center">No investments tracked yet</p>
          ) : (
            inv.map((h) => (
              <SavingsHoldingRow
                key={h.id}
                holding={h}
                baseCurrency={settings.baseCurrency}
                exchangeRates={exchangeRates}
                onDelete={deleteSavingsHolding}
              />
            ))
          )}
        </section>
      </div>

      <QuickAddFAB />
    </div>
  )
}
