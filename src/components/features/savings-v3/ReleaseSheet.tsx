'use client'

import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ModalShell } from '@/components/modals/ModalShell'
import { AmountHero } from '@/components/ui/AmountHero'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PickerRow } from '@/components/ui/PickerRow'
import { useActionToast } from '@/components/ui/ActionToast'
import { AccountNameValue } from '@/components/features/accounts/AccountPicker'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
import { PocketTile, SheetBody, SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { useDiscardPrompt } from '@/components/features/savings-v3/useDiscardPrompt'
import { useSubmitOnce } from '@/hooks/useSubmitOnce'
import { useT } from '@/lib/i18n'
import { useSavingsV9Copy } from '@/lib/i18n/savingsV9Copy'
import { balanceEpsilon } from '@/lib/savings/balanceMath'
import { pocketDisplayName } from '@/lib/savings/pocketIdentity'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { SavingsAccount } from '@/lib/store/types'
import { formatWhole } from '@/lib/utils/formatters'

/**
 * Release (final-ui v9): money set aside in an account goes back to Free to spend. It stays in the account; only the
 * pocket's label changes (`releasePart`, LOGIC_SPEC §0), so nothing moves at the bank.
 */
export function ReleaseSheet({ account, onClose }: { account: SavingsAccount; onClose: () => void }) {
  const c = useSavingsV9Copy().release
  const sf = useT().savingsForms
  const showToast = useActionToast()
  const submitOnce = useSubmitOnce(true)
  const { methods, releasePart } = useFinanceStore(useShallow((s) => ({ methods: s.paymentMethods, releasePart: s.releasePart })))
  const holder = methods.find((m) => m.id === account.heldInPaymentMethodId)
  const [amount, setAmount] = useState('')
  const discard = useDiscardPrompt(amount.trim() !== '', onClose)
  const name = pocketDisplayName(account, sf.systemNames)
  const n = parseFloat(amount) || 0
  const over = n > account.currentBalance + balanceEpsilon(account.currency)
  const canSubmit = n > 0 && !over && !!holder

  const submit = () => {
    if (!canSubmit || !submitOnce.claim()) return
    if (!releasePart(account.id, n)) {
      submitOnce.release()
      return showToast(c.failed)
    }
    showToast(c.done)
    onClose()
  }

  return (
    <ModalShell open onBackdropClick={discard.close} scrollChild>
      {discard.prompt}
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={discard.close}>
          <V3SheetHeader.Title>{c.title}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{c.sub(name)}</V3SheetHeader.Subtitle>
        </V3SheetHeader>
        <SheetBody className="space-y-3 pt-0">
          <AmountHero
            value={amount}
            onChange={setAmount}
            currency={account.currency}
            top={<PocketTile account={account} className="size-[52px] rounded-2xl" iconClassName="size-6" />}
            line={<span className="font-mono-numbers">{c.line(name, formatWhole(account.currentBalance), formatWhole(Math.max(0, account.currentBalance - n)))}</span>}
            className="px-0"
          />
          <Card padding="none" divide className="overflow-hidden">
            <PickerRow label={c.from} value={<span dir="auto" className="truncate">{name}</span>} />
            {holder ? <PickerRow label={c.staysIn} value={<AccountNameValue method={holder} />} /> : null}
          </Card>
          {over ? (
            <p role="alert" className="text-[0.8125rem] text-[var(--color-brand-amber)]">{c.over(`${formatWhole(account.currentBalance)} ${account.currency}`)}</p>
          ) : holder ? (
            <p className="px-1 text-xs leading-relaxed text-[var(--color-brand-text-muted)]">{c.note(accountTitle(holder))}</p>
          ) : null}
        </SheetBody>
        <SheetFooter safeArea>
          <Button size="cta-block" onClick={submit} disabled={!canSubmit} className="font-semibold">{c.cta(n > 0 ? formatWhole(n) : '0')}</Button>
        </SheetFooter>
      </div>
    </ModalShell>
  )
}
