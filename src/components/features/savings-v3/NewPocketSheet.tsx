'use client'

import { useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { PocketFormSheet } from '@/components/features/savings-v3/PocketFormSheet'
import { POCKET_KINDS, POCKET_KIND_ORDER, type PocketKindDef } from '@/lib/savings/pocketKinds'
import type { PaymentMethod, SavingsType } from '@/lib/store/types'

const label: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-brand-text-muted)' }
const hexToRgb = (hex: string) => { const h = hex.replace('#', ''); return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}` }

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

  const openForm = (def: PocketKindDef, method: PaymentMethod | null) => {
    setLinkedMethod(method)
    setFormDef(def)
  }

  if (!open) return null

  if (formDef) {
    return (
      <PocketFormSheet
        open onClose={() => { setFormDef(null); setLinkedMethod(null); onClose() }}
        def={formDef} linkedMethod={linkedMethod}
      />
    )
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="flex flex-col" style={{ maxHeight: '92vh' }}>
        <div className="flex items-start justify-between px-5 pt-4 pb-1">
          <div>
            <h2 className="text-[22px] font-bold text-[var(--color-brand-text-primary)]">New pocket</h2>
            <p className="mt-0.5 text-sm text-[var(--color-brand-text-secondary)]">Where does this money actually sit?</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-3 space-y-4">
          {paymentMethods.length > 0 && (
            <div>
              <p style={label}>From your payment methods</p>
              <div className="mt-2 space-y-2.5">
                {paymentMethods.map((pm) => {
                  const used = usedPmIds.has(pm.id)
                  const kind = pm.type === 'wallet' ? POCKET_KINDS.wallet : POCKET_KINDS.bank
                  return (
                    <button key={pm.id} type="button" disabled={used}
                      onClick={() => openForm(kind, pm)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3 text-left"
                      style={{ opacity: used ? 0.55 : 1 }}>
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `rgba(${hexToRgb(pm.color ?? '#7EAEF9')},.14)`, color: pm.color ?? '#7EAEF9' }}>
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
                    </button>
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
                  <button key={k} type="button" onClick={() => openForm(def, null)}
                    className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3.5 text-left">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `rgba(${hexToRgb(def.color)},.14)`, color: def.color }}>
                      <SavingsAccountIcon account={{ type: def.savingsType, icon: def.icon }} className="h-5 w-5" />
                    </span>
                    <p className="mt-2.5 text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{def.label}</p>
                    <p className="text-xs text-[var(--color-brand-text-muted)]">{def.sub}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
