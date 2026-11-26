import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/hooks/useRequireAuthAction', () => ({ useRequireAuthAction: () => (fn: () => void) => fn() }))
const { addDebtTarget } = await import('./AddDebtOptionSheet')

const SRC = join(__dirname, '../../../..')
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8')

describe('Add a debt option sheet (Q4: Flow > + > Pay debt > "Add a debt" with no debts)', () => {
  it('sends a credit card to the payment-method sheet and the others to the debt form', () => {
    expect(addDebtTarget('credit_card')).toEqual({ modal: 'addCreditCard' })
    expect(addDebtTarget('borrow')).toEqual({ family: 'personal' })
    expect(addDebtTarget('installment')).toEqual({ family: 'installment' })
  })

  it('the Pay debt picker\'s "Add a debt" and "Add new debt" open this sheet, over the picker, not the older pick step', () => {
    const sheet = read('components/modals/AddDebtSheet.tsx')
    expect(sheet).toContain('<AddDebtOptionSheet open={open && addPickOpen} onClose={() => setAddPickOpen(false)} overSheet />')
    expect(sheet.match(/onClick=\{\(\) => setAddPickOpen\(true\)\}/g)).toHaveLength(2)
    expect(sheet).not.toContain('openDebtSheetNew()}')
  })

  it('the Debts page uses the same sheet (one definition of the options)', () => {
    const page = read('app/(app)/debts/page.tsx')
    expect(page).toContain('<AddDebtOptionSheet open={addOpen} onClose={() => setAddOpen(false)} />')
    expect(page).not.toContain('<OptionSheet<AddKind>')
  })

  it('has its title, question and three choices in English and Arabic', async () => {
    const { DEBTS_SUBS_LT_COPY } = await import('@/lib/i18n/debtsSubsLtCopy')
    for (const lang of ['en', 'ar'] as const) {
      const c = DEBTS_SUBS_LT_COPY[lang].debts
      for (const s of [c.addTitle, c.addSub, c.addBorrow.title, c.addInstallment.title, c.addCard.title]) expect(s.trim()).not.toBe('')
    }
  })
})
