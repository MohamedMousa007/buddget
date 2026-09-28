'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { PocketFormSheet } from '@/components/features/savings-v3/PocketFormSheet'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { POCKET_KINDS, POCKET_KIND_ORDER, type PocketKindDef } from '@/lib/savings/pocketKinds'
import { rgba } from '@/lib/utils/color'
import { micro as label } from '@/lib/ui/microLabelStyle'
import type { PaymentMethod, SavingsType } from '@/lib/store/types'
import { SelectableCard } from '@/components/ui/SelectableCard'

const PM_TYPE_LABEL: Record<string, string> = {
  bank_account: 'Bank account', debit_card: 'Debit card', credit_card: 'Credit card',
  wallet: 'Wallet', cash: 'Cash', prepaid_card: 'Prepaid', bnpl: 'BNPL', other: 'Account',
}

export interface NewPocketSheetProps {
  open: boolean
  onClose: () => void
}

export function NewPocketSheet({ open, onClose }: NewPocketSheetProps) {
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const savingsAccounts = useFinanceStore((s) => s.savingsAccounts)
  const [formDef, setFormDef] = useState<PocketKindDef | null>(null)
  const [linkedMethod, setLinkedMethod] = useState<PaymentMethod | null>(null)

  const usedPmIds = new Set(savingsAccounts.map((a) => a.linkedPaymentMethodId).filter(Boolean))
  // Only methods you can actually keep money in — a bank/wallet/prepaid/debit holds a balance;
  // a credit card, BNPL or cash pocket does not (you'd add cash from scratch). No PM↔PM link
  // exists to dedup a bank from its own debit card, so both may appear (noted follow-up).
  const HOLDS_MONEY = new Set(['bank_account', 'wallet', 'prepaid_card', 'debit_card'])
  const holdablePms = paymentMethods.filter((pm) => HOLDS_MONEY.has(pm.type))

  const openForm = (def: PocketKindDef, method: PaymentMethod | null) => {
    setLinkedMethod(method)
    setFormDef(def)
  }

  if (!open) return null

  // Stack the chooser + form as two ModalShells (like the payment-methods flow) so each
  // registers its own LIFO back guard — the hardware back button peels the form first, then
  // the chooser, instead of collapsing both at once (design-system rule: layered sheets step
  // back one level at a time).
  return (
    <>
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="flex flex-col" style={{ maxHeight: '92vh' }}>
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>New pocket</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>Where does this money actually sit?</V3SheetHeader.Subtitle>
        </V3SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-3 space-y-4">
          {holdablePms.length > 0 && (
            <div>
              <p style={label}>From your payment methods</p>
              <div className="mt-2 space-y-2.5">
                {holdablePms.map((pm) => {
                  const used = usedPmIds.has(pm.id)
                  const kind = pm.type === 'wallet' ? POCKET_KINDS.wallet : POCKET_KINDS.bank
                  return (
                    <SelectableCard key={pm.id} as="action" disabled={used}
                      onClick={() => openForm(kind, pm)}
                      className="gap-3 p-3"
                      style={{ opacity: used ? 0.55 : 1 }}>
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: rgba(pm.color ?? '#7EAEF9', .14), color: pm.color ?? '#7EAEF9' }}>
                        <SavingsAccountIcon account={{ type: 'bank' as SavingsType, icon: 'CreditCard' }} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{pm.name} · {PM_TYPE_LABEL[pm.type] ?? 'Account'}</p>
                        <p className="truncate font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{pm.last4 ? `••••${pm.last4} · ` : ''}{pm.currency}</p>
                      </div>
                      {used ? (
                        <span className="rounded-full border border-[rgba(53,212,111,.4)] px-2.5 py-1 text-[10px] font-bold tracking-wide" style={{ color: '#35D46F' }}>ALREADY A POCKET</span>
                      ) : (
                        <ChevronRight size={18} className="text-[var(--color-brand-text-muted)]" />
                      )}
                    </SelectableCard>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <p style={label}>Or start from scratch</p>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {POCKET_KIND_ORDER.map((k) => {
                const def = POCKET_KINDS[k]
                return (
                  <SelectableCard key={k} as="action" layout="stack" onClick={() => openForm(def, null)} className="p-3.5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: rgba(def.color, .14), color: def.color }}>
                      <SavingsAccountIcon account={{ type: def.savingsType, icon: def.icon }} className="h-5 w-5" />
                    </span>
                    <p className="mt-2.5 text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{def.label}</p>
                    <p className="text-xs text-[var(--color-brand-text-muted)]">{def.sub}</p>
                  </SelectableCard>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
    {formDef && (
      <PocketFormSheet
        open
        onClose={() => { setFormDef(null); setLinkedMethod(null) }}
        onDone={() => { setFormDef(null); setLinkedMethod(null); onClose() }}
        def={formDef} linkedMethod={linkedMethod}
      />
    )}
    </>
  )
}
