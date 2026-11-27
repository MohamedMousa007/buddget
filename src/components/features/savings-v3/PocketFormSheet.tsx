'use client'

import { toLatinDigits } from '@/lib/utils/formatters'
import { useMemo, useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { AmountField } from '@/components/ui/AmountField'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { ColorSwatchRow } from '@/components/ui/ColorSwatchRow'
import { PAYMENT_BRANDS, QUICK_ADD_BLEND, brandIssuesType, decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { type PocketKindDef } from '@/lib/savings/pocketKinds'
import { rgba } from '@/lib/utils/color'
import { micro } from '@/lib/ui/microLabelStyle'
import type { Currency, PaymentMethod } from '@/lib/store/types'
import { OptionChip } from '@/components/ui/OptionChip'
import { useT } from '@/lib/i18n'
import { useAccounts } from '@/lib/accounts/useAccounts'
import { linkedPocketCurrency, pocketHolderId } from '@/lib/savings/pocketHolder'
import { splitMoney } from '@/components/features/accounts/accountDisplay'

export interface PocketFormSheetProps {
  open: boolean
  /** Step back one level (back button / X / backdrop) — returns to the chooser, not the page. */
  onClose: () => void
  /** Full dismiss after a successful create (tears down the whole flow). Defaults to onClose. */
  onDone?: () => void
  def: PocketKindDef
  /** Prefill + link when created from an existing payment method. */
  linkedMethod?: PaymentMethod | null
  /** Hands back the new pocket, so a sheet that opened this flow can select it. */
  onCreated?: (id: string, currency: Currency) => void
}

export function PocketFormSheet({ open, onClose, onDone, def, linkedMethod, onCreated }: PocketFormSheetProps) {
  const t = useT()
  const sf = t.savingsForms
  const pf = sf.pocket
  const kindLabel = sf.pocketKinds[def.kind].label
  const addSavingsAccount = useFinanceStore((s) => s.addSavingsAccount)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const { accounts } = useAccounts()

  const has = (f: string) => def.fields.includes(f as never)

  // From an existing payment method the provider + last4 come locked from the method — split the
  // composed name ("CIB ••2016") into its bare provider so we don't duplicate it across three
  // fields, and hide the last-4 input (it's already known).
  const fromPM = !!linkedMethod
  const decomposed = linkedMethod ? decomposePaymentMethodName(linkedMethod.name, linkedMethod.last4 ?? undefined) : null

  const [provider, setProvider] = useState(decomposed?.provider ?? '')
  const [last4, setLast4] = useState(linkedMethod?.last4 ?? '')
  const [maturity, setMaturity] = useState('')
  const [name, setName] = useState(decomposed?.provider ?? kindLabel)
  const [balance, setBalance] = useState('')
  // From an account the currency is the account's own and the field is locked.
  const [pickedCurrency, setCurrency] = useState<Currency>(baseCurrency)
  const currency = linkedMethod ? linkedPocketCurrency(linkedMethod, paymentMethods) : pickedCurrency
  const [color, setColor] = useState(def.color)
  // Emergency cover is a threshold over ALL savings now (set on the emergency card), not per pocket.

  // Provider chips from the app-wide catalogue, filtered to what THIS pocket kind can hold
  // (a bank pocket shows banks, not Vodafone Cash / InstaPay). One pool, not a hardcoded list.
  const providerNames = useMemo(() => {
    const issues = def.kind === 'wallet' ? 'wallet' : 'bank_account'
    const ids = QUICK_ADD_BLEND.filter((id) => PAYMENT_BRANDS[id] && brandIssuesType(PAYMENT_BRANDS[id], issues))
    return [...new Set(ids.map((id) => PAYMENT_BRANDS[id].name))].slice(0, 10)
  }, [def.kind])

  // From a tracked account the pocket is an earmark inside it: the money stays in the account, so it cannot exceed what is free there.
  const holderId = linkedMethod ? pocketHolderId(linkedMethod, paymentMethods, currency) : undefined
  const holderFree = holderId ? accounts.find((a) => a.method.id === holderId)?.balance?.free : undefined
  const free = holderFree === undefined ? undefined : Math.max(0, holderFree)
  const overFree = free !== undefined && (parseFloat(balance) || 0) > free

  const create = () => {
    if (overFree) return
    const id = addSavingsAccount({
      name: name.trim() || kindLabel,
      category: 'savings',
      type: def.savingsType,
      currency,
      openingBalance: parseFloat(balance) || 0,
      color,
      icon: def.icon,
      ...(provider ? { institution: provider } : {}),
      ...(last4 ? { accountLast4: last4 } : {}),
      ...(maturity ? { maturityDate: maturity } : {}),
      ...(holderId ? { heldInPaymentMethodId: holderId } : {}),
    } as never)
    onCreated?.(id, currency)
    ;(onDone ?? onClose)()
  }

  if (!open) return null

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{pf.newTitle(kindLabel)}</V3SheetHeader.Title>
        </V3SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3 space-y-4">
          {/* preview */}
          <div className="flex items-center gap-3 rounded-2xl p-3.5" style={{ border: `1px solid ${rgba(color, .35)}`, background: rgba(color, .06) }}>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: rgba(color, .16), color }}>
              <SavingsAccountIcon account={{ type: def.savingsType, icon: def.icon }} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{name || kindLabel}</p>
              <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{linkedMethod ? pf.linked : pf.newPocket}</p>
            </div>
          </div>

          {has('provider') && fromPM && (
            <div>
              <label style={micro}>{pf.provider}</label>
              <div className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 text-sm font-medium text-[var(--color-brand-text-primary)]">
                {provider}{last4 ? <span className="font-mono-numbers text-[var(--color-brand-text-muted)]">••{last4}</span> : null}
              </div>
            </div>
          )}

          {has('provider') && !fromPM && (
            <div>
              <label style={micro}>{pf.provider}</label>
              <div className="mt-2 flex gap-2 overflow-x-auto hide-scrollbar">
                {providerNames.map((p) => (
                  <OptionChip key={p} selected={provider === p} onClick={() => setProvider(p)}>
                    {p}
                  </OptionChip>
                ))}
                <OptionChip selected={provider === ''} onClick={() => setProvider('')}>
                  {pf.other}
                </OptionChip>
              </div>
            </div>
          )}

          {has('last4') && !fromPM && (
            <div>
              <label style={micro}>{pf.last4}</label>
              <Input value={last4} onChange={(e) => setLast4(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4))} placeholder="2016" inputMode="numeric"
                size="brand" className="mt-2 font-mono-numbers" />
            </div>
          )}

          {has('maturity') && (
            <div>
              <label style={micro}>{pf.maturesOn}</label>
              <DatePickerField value={maturity} onChange={setMaturity} className="mt-2" />
            </div>
          )}

          <div>
            <label style={micro}>{pf.pocketName}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={kindLabel}
              size="brand" className="mt-2" />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label style={micro}>{pf.inItNow}</label>
              <AmountField value={balance} onChange={setBalance} currency={currency} placeholder="0.00"
                className="mt-2 h-12 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 font-mono-numbers" />
              {overFree && (
                <p role="alert" className="mt-2 text-[0.8125rem] text-[var(--color-brand-amber)]">
                  {t.accountsPage.moreThanFree(splitMoney(free!, currency).int + splitMoney(free!, currency).dec)}
                </p>
              )}
            </div>
            <div style={{ width: 104 }}>
              <label style={micro}>{pf.currency}</label>
              <CurrencyField value={currency} onChange={(c) => setCurrency(c as unknown as Currency)} disabled={fromPM}
                className="mt-2 h-12 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-primary)] w-full" />
            </div>
          </div>

          <div>
            <label style={micro}>{pf.colour}</label>
            <div className="mt-2">
              <ColorSwatchRow value={color} onChange={setColor} />
            </div>
          </div>
        </div>

        <div className="px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <Button size="cta-block" onClick={create} disabled={overFree} className="font-semibold">
            {pf.create}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
