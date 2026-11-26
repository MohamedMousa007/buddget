import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { accountDisplayName } from '../accountTitle'

const read = (rel: string) => readFileSync(join(__dirname, '../../../', rel), 'utf8')

describe('the account display name (W2)', () => {
  it("is the user's Name when set, else the provider without the digits", () => {
    expect(accountDisplayName({ name: 'CIB ••1234', last4: '1234', label: 'QA CIB' })).toBe('QA CIB')
    expect(accountDisplayName({ name: 'CIB ••1234', last4: '1234', label: '  ' })).toBe('CIB')
    expect(accountDisplayName({ name: 'CIB', last4: undefined, label: undefined })).toBe('CIB')
  })
  it.each([
    ['components/features/accounts/AccountRow.tsx', 'const title = accountDisplayName(method)'],
    ['components/features/accounts/CardRow.tsx', '`${accountDisplayName(parent)} ${kind}`'],
    ['components/features/expenses/MethodValue.tsx', '{accountDisplayName(method)}'],
    ['components/features/accounts/AddAccountSheet.tsx', 'saveFirstBody(label.trim() || provider.trim())'],
    ['components/features/payments/PaymentMethodPicker.tsx', '(parentOf(selPay) ?? selPay).label?.trim() ||'],
  ])('%s shows it', (file, needle) => {
    expect(read(file)).toContain(needle)
  })
})
