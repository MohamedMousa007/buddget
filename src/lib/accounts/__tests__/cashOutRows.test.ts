import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { cashOut, ensureCashAccount, setOpeningBalance } from '../actions'
import { arrivesIn, sheetActivity } from '../cardDetails'
import { isCashOut } from '../cashOutRow'
import { isInternalMoveCategory } from '@/lib/constants/categoryMeta'

const s = () => useFinanceStore.getState()

describe('a Cash out shows where the money went (W2)', () => {
  let bank = ''
  let cash = ''
  beforeEach(() => {
    s().reset()
    bank = s().addPaymentMethod({ name: 'CIB', type: 'bank_account', currency: 'EGP', isDefault: false })
    setOpeningBalance(bank, 1000, new Date(Date.now() - 86_400_000))
    cash = ensureCashAccount()
    cashOut(bank, 500, 'EGP')
  })

  it("lists in the Cash account's Recent as money in, and in the bank's as money out", () => {
    const row = s().expenses.at(-1)!
    const methods = s().paymentMethods
    expect(sheetActivity(undefined, cash, s().expenses, methods).map((e) => e.id)).toContain(row.id)
    expect(arrivesIn(row, cash, methods)).toBe(true)
    expect(sheetActivity(undefined, bank, s().expenses, methods).map((e) => e.id)).toContain(row.id)
    expect(arrivesIn(row, bank, methods)).toBe(false)
  })

  it('a plain expense never arrives anywhere, even with no method (which resolves to Cash)', () => {
    expect(arrivesIn({ toPaymentMethodId: undefined }, cash, s().paymentMethods)).toBe(false)
  })

  it('is the one internal move Flow lists, as an uncounted row with no category facet', () => {
    const row = s().expenses.at(-1)!
    expect(isInternalMoveCategory(row.category)).toBe(true)
    expect(isCashOut(row)).toBe(true)
    expect(isCashOut({ category: 'Transfer', toPaymentMethodId: cash })).toBe(false)
    expect(isCashOut({ category: 'Top up', toPaymentMethodId: cash })).toBe(false)
    expect(isCashOut({ ...row, refundKind: 'declined' })).toBe(false)
    const ledger = readFileSync(join(__dirname, '../../../components/features/flow/useFlowLedger.tsx'), 'utf8')
    expect(ledger).toContain('isInternalMoveCategory(e.category) && !isCashOut(e)) continue')
    expect(ledger).toContain("facet: isCashOut(e) ? '' : e.category")
    expect(ledger).toContain('counted: !dim && !nonSpend')
  })
})
