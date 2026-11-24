'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SheetBody, SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { ACCOUNT_CURRENCY_FIELD_CLASS } from '@/components/features/payments/accountFormParts'
import { Button } from '@/components/ui/button'
import { AmountField } from '@/components/ui/AmountField'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { changeCashCurrency } from '@/lib/accounts/actions'
import type { AccountView } from '@/lib/accounts/useAccounts'
import { useCashCurrencyCopy } from '@/lib/i18n/cashCurrencyCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency } from '@/lib/store/types'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { microClassName } from '@/lib/ui/microLabelStyle'

interface CashCurrencySheetProps {
  open: boolean
  onClose: () => void
  account: AccountView
}

/** Cash in another currency. With money in it, the amount is asked again in the new currency, prefilled at today's rate. */
export function CashCurrencySheet({ open, onClose, account }: CashCurrencySheetProps) {
  const t = useCashCurrencyCopy()
  const rates = useFinanceStore((s) => s.exchangeRates)
  const from = account.method.currency
  const [to, setTo] = useState<Currency>(from)
  const [value, setValue] = useState('')
  const balance = account.balance?.balance ?? 0
  const asksAmount = to !== from && balance !== 0
  const amount = parseFloat(value)
  const valid = to !== from && (!asksAmount || Number.isFinite(amount))

  const pick = (next: Currency) => {
    setTo(next)
    const converted = tryConvertCurrency(balance, String(from), String(next), rates)
    setValue(converted === null ? '' : String(Math.round(converted * 100) / 100))
  }
  const save = () => {
    if (!valid) return
    changeCashCurrency(account.method.id, to, asksAmount ? amount : 0)
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{t.title}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{t.sub}</V3SheetHeader.Subtitle>
        </V3SheetHeader>
        <SheetBody className="space-y-4 pt-3">
          <div>
            <div className={`mx-0.5 mb-2 ${microClassName}`}>{t.currency}</div>
            <CurrencyField value={to} onChange={(c) => pick(c as unknown as Currency)} className={ACCOUNT_CURRENCY_FIELD_CLASS} zIndexClassName="z-[130]" />
          </div>
          {asksAmount ? (
            <div>
              <div className={`mx-0.5 mb-2 ${microClassName}`}>{t.amountIn(String(to))}</div>
              <AmountField value={value} onChange={setValue} currency={String(to)} placeholder="0" />
              <p className="mt-2 text-[0.8125rem] text-[var(--color-brand-text-muted)]">{t.amountHint}</p>
            </div>
          ) : null}
        </SheetBody>
        <SheetFooter safeArea>
          <Button size="cta-block" onClick={save} disabled={!valid} className="font-semibold">{t.save}</Button>
        </SheetFooter>
      </div>
    </ModalShell>
  )
}
