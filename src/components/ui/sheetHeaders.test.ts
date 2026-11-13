/**
 * The standard sheet header is V3SheetHeader (title + one 44px close that calls the sheet's own close handler).
 * These sheets were moved onto it; this stops a hand-built title and close pair from creeping back in.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const MIGRATED = [
  'src/components/features/subscriptions/SheetFrame.tsx',
  'src/components/modals/AssignIncomeSheet.tsx',
  'src/components/modals/ResolveSheet.tsx',
  'src/components/modals/AddDebtSheet.tsx',
  'src/components/modals/PaymentMethodsSheet.tsx',
  'src/components/modals/AmountReceivedSheet.tsx',
  'src/components/ui/CurrencySheet.tsx',
  'src/components/features/payments/SelectPaymentMethodSheet.tsx',
  'src/components/features/payments/ProviderPickerSheet.tsx',
  'src/components/features/payments/PaymentMethodSetupSheet.tsx',
  'src/components/features/debts/redesign/InstallmentProviderPickerSheet.tsx',
  'src/components/features/debts/redesign/ChargesSheet.tsx',
  'src/components/features/goals/new/CostSheet.tsx',
  'src/components/features/settings/hub/TwoFactorOffSheet.tsx',
]

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('migrated sheets use the standard header', () => {
  for (const file of MIGRATED) {
    it(file, () => {
      const src = read(file)
      expect(src).toContain('V3SheetHeader')
      // A title wired by hand, or by ModalTitle/ModalHeading, would be a second header in the same sheet.
      expect(src).not.toMatch(/import\s*\{[^}]*\b(ModalTitle|ModalHeading)\b[^}]*\}\s*from/)
      expect(src).not.toContain('useModalTitleId()')
    })
  }
  it('no hand-built tinted close button sits next to the title in the plain-header sheets', () => {
    for (const file of MIGRATED.filter((f) => !f.endsWith('PaymentMethodSetupSheet.tsx') && !f.endsWith('InstallmentProviderPickerSheet.tsx'))) {
      expect(read(file), file).not.toMatch(/variant="tinted"\s+size="sm"\s+shape="round"[^>]*>\s*<X\b/)
    }
  })
})
