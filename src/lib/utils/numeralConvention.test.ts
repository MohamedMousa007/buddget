import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')
const SITES = [
  'components/features/settings/CurrencyConverterCore.tsx', 'components/features/settings/CurrencyConverterGoldRow.tsx',
  'components/features/debts/redesign/AddInstallmentForm.tsx', 'components/features/debts/redesign/AddBorrowForm.tsx',
  'components/features/income/IncomeTemplatePicker.tsx', 'components/features/accounts/AccountDetailSheet.tsx',
]

describe('TZL-9: numerals are Latin on every device locale', () => {
  it.each(SITES)('%s formats numbers and dates without the device locale or a fixed English one', (f) => {
    const src = readFileSync(join(ROOT, f), 'utf8')
    expect(src).not.toMatch(/toLocaleString\(\s*(undefined)?\s*[,)]/)
    expect(src).not.toMatch(/toLocaleDateString\('en-US'/)
  })
})
