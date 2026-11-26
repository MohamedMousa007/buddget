import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { methodDisplayName } from './paymentMethodDefaults'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import { ar } from '@/lib/i18n/dictionaries/ar'

describe('methodDisplayName (QA-114)', () => {
  const cash = ar.accountsPage.typeCash
  it('shows the built-in Cash in the dictionary language', () => {
    expect(methodDisplayName({ id: DEFAULT_CASH_ID, name: 'Cash' }, cash)).toBe(cash)
    expect(cash).toBe('نقد')
  })
  it('leaves a renamed Cash, a real cash account and any bank as typed', () => {
    expect(methodDisplayName({ id: DEFAULT_CASH_ID, name: 'Wallet at home' }, cash)).toBe('Wallet at home')
    expect(methodDisplayName({ id: 'real-1', name: 'Cash' }, cash)).toBe('Cash')
    expect(methodDisplayName({ id: 'b', name: 'CIB' }, cash)).toBe('CIB')
  })
})

describe('currency field names follow the language (QA-114)', () => {
  it('CurrencyField prints the localized currency name, never the English meta.name', () => {
    const src = readFileSync(join(__dirname, '../../components/ui/CurrencyField.tsx'), 'utf8')
    expect(src).toContain('currencyName(value)')
    expect(src).not.toContain('{meta.name}')
  })
  it('the expense sheet shows the currency code inline after the amount (AmountHero), not a name field', () => {
    const src = readFileSync(join(__dirname, '../../components/features/expenses/ExpenseSheetForm.tsx'), 'utf8')
    expect(src).toContain('<AmountHero')
    expect(src).not.toContain('CurrencyField')
  })
})
