'use client'

import { useState, useMemo } from 'react'
import { ArrowDownUp } from 'lucide-react'
import type { FinanceStore } from '@/lib/store/types'
import { useT } from '@/lib/i18n'
import { CONVERTER_CODES } from '@/components/features/settings/currencyConverterConstants'
import { CurrencyConverterAmountBlock } from '@/components/features/settings/CurrencyConverterAmountBlock'
import type { Dictionary } from '@/lib/i18n/types'

type SettingsCopy = Dictionary['settings']

/**
 * Amount in / swap / amount out + cross-rate lines (no header or gold row).
 */
export function CurrencyConverterCore({ store, t }: { store: FinanceStore; t: SettingsCopy }) {
  const tc = useT()
  const [fromCurrency, setFromCurrency] = useState<string>(store.settings.baseCurrency)
  const [toCurrency, setToCurrency] = useState<string>(
    store.settings.secondaryCurrency || (store.settings.baseCurrency === 'AED' ? 'EGP' : 'AED')
  )
  const [amount, setAmount] = useState<string>('1')

  const rate = useMemo(() => {
    if (fromCurrency === toCurrency) return 1
    const key = `${fromCurrency}_${toCurrency}`
    return (store.exchangeRates[key] as number) || null
  }, [fromCurrency, toCurrency, store.exchangeRates])

  const convertedAmount = useMemo(() => {
    if (!rate) return null
    const num = parseFloat(amount)
    if (isNaN(num)) return null
    return num * rate
  }, [amount, rate])

  const handleSwap = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  const availableCurrencies = CONVERTER_CODES.filter((c) => {
    if (c === 'USD') return true
    return Boolean(store.exchangeRates[`USD_${c}`] || store.exchangeRates[`${c}_USD`])
  })

  const resultText =
    convertedAmount !== null
      ? convertedAmount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        })
      : '—'

  return (
    <>
      <CurrencyConverterAmountBlock
        variant="input"
        amount={amount}
        onAmountChange={setAmount}
        currency={fromCurrency}
        onCurrencyChange={setFromCurrency}
        availableCurrencies={availableCurrencies}
      />

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleSwap}
          className="p-2 rounded-full bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] hover:bg-[var(--color-brand-card)] transition-colors"
          aria-label={tc.common.ariaSwapCurrencies}
        >
          <ArrowDownUp className="w-4 h-4 text-[var(--color-brand-text-secondary)]" aria-hidden />
        </button>
      </div>

      <CurrencyConverterAmountBlock
        variant="result"
        amount={resultText}
        currency={toCurrency}
        onCurrencyChange={setToCurrency}
        availableCurrencies={availableCurrencies}
      />

      {rate ? (
        <p className="text-center text-xs text-[var(--color-brand-text-muted)]">
          1 {fromCurrency} = {rate.toFixed(4)} {toCurrency}
          {' · '}
          1 {toCurrency} = {(1 / rate).toFixed(4)} {fromCurrency}
        </p>
      ) : null}
      {!rate && fromCurrency !== toCurrency ? (
        <p className="text-center text-xs text-[var(--color-brand-red)]">{t.currencyConverterNoRate}</p>
      ) : null}
    </>
  )
}
