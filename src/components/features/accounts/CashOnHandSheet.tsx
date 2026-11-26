'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Banknote, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AmountHero } from '@/components/ui/AmountHero'
import { HEADER_PILL, Pill } from '@/components/ui/PillButton'
import { ensureCashAccount, setOpeningBalance } from '@/lib/accounts/actions'
import { CASH_ASK_KEY } from '@/lib/accounts/cashOnHand'
import { cashCurrency } from '@/lib/accounts/resolve'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useT } from '@/lib/i18n'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { MoveIconTile } from './MoveMoneySheet'

/**
 * How much cash is on hand: asked once after the first cash expense, or from "Start tracking" on Accounts. The answer
 * starts Cash's balance, kept from then on as an estimate.
 */
export function CashOnHandSheet() {
  const dict = useT()
  const c = useAccountsLtCopy().cash
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
        <V3SheetHeader onClose={close} leading={<Pill icon={<Calendar />} className={HEADER_PILL}>{c.countedToday}</Pill>}>
          <V3SheetHeader.Title><span className="sr-only">{c.title}</span></V3SheetHeader.Title>
        </V3SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pb-3">
          <AmountHero value={value} onChange={setValue} currency={String(currency)} aria-label={c.title}
            top={<MoveIconTile><Banknote /></MoveIconTile>}
            line={(
              <>
                <span dir="auto" className="mt-3 block text-base font-semibold text-[var(--color-brand-text-primary)]">{c.title}</span>
                <span dir="auto" className="mt-1.5 block text-xs text-[var(--color-brand-text-secondary)] [text-wrap:pretty]">{c.sub}</span>
              </>
            )} />
        </div>
        <div className="shrink-0 border-t border-[var(--color-brand-border)] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          <Button size="cta-block" onClick={save} disabled={!valid} className="font-semibold">{dict.common.save}</Button>
        </div>
      </div>
    </ModalShell>
  )
}
