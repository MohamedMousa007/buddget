'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SheetBody, SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { Button } from '@/components/ui/button'
import { AmountField } from '@/components/ui/AmountField'
import { ensureCashAccount, setOpeningBalance } from '@/lib/accounts/actions'
import { CASH_ASK_KEY } from '@/lib/accounts/cashOnHand'
import { cashCurrency } from '@/lib/accounts/resolve'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useT } from '@/lib/i18n'

/** Asked once, after the first cash expense: the answer starts Cash's balance, kept from then on as an estimate. */
export function CashOnHandSheet() {
  const dict = useT()
  const t = dict.accountsPage
  const open = useSettingsStore((s) => s.activeModal === 'askCashOnHand')
  // The answer is stored in Cash's own currency, so it is asked in that currency.
  const currency = useFinanceStore((s) => cashCurrency(s.paymentMethods, s.settings.baseCurrency))
  const [value, setValue] = useState('')
  const amount = parseFloat(value)
  const valid = Number.isFinite(amount) && amount >= 0

  const close = () => {
    const ui = useSettingsStore.getState()
    ui.dismissBanner(CASH_ASK_KEY)
    ui.setActiveModal(null)
    setValue('')
  }
  const save = () => {
    if (!valid) return
    setOpeningBalance(ensureCashAccount(), amount)
    close()
  }
  useEscapeClose(open, close)

  return (
    <ModalShell open={open} onBackdropClick={close} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={close}>
          <V3SheetHeader.Title>{t.cashAskTitle}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{t.cashAskSub}</V3SheetHeader.Subtitle>
        </V3SheetHeader>
        <SheetBody className="space-y-3 pt-3">
          <AmountField value={value} onChange={setValue} currency={String(currency)} placeholder="0" />
        </SheetBody>
        <SheetFooter safeArea>
          <div className="flex flex-col gap-2">
            <Button size="cta-block" onClick={save} disabled={!valid} className="font-semibold">{dict.common.save}</Button>
            <Button size="cta-block" variant="outline" onClick={close}>{t.cashAskSkip}</Button>
          </div>
        </SheetFooter>
      </div>
    </ModalShell>
  )
}
