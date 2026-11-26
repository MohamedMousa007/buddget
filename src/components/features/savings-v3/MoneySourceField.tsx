'use client'

import { useState, type ReactNode } from 'react'
import { ArrowLeftRight, PiggyBank, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PickerRow } from '@/components/ui/PickerRow'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { AccountPicker } from '@/components/features/accounts/AccountPicker'
import { BrandMark } from '@/components/features/accounts/BrandMark'
import { accountColor, accountTitle } from '@/components/features/accounts/accountDisplay'
import { SelectPaymentMethodSheet } from '@/components/features/payments/SelectPaymentMethodSheet'
import { PocketPickerField } from '@/components/features/savings-v3/MoneySheetParts'
import type { PocketVM } from '@/components/features/savings-v3/types'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import type { AccountView } from '@/lib/accounts/useAccounts'
import type { PaymentMethod } from '@/lib/store/types'

export type MoneySourceKind = 'account' | 'pocket' | 'outside'

/** Where money comes from: an account (payment method id), a pocket (savings account id), or outside buddget (no id). */
export interface MoneySource {
  kind: MoneySourceKind
  id?: string
}

export interface MoneySourceFieldProps {
  value: MoneySource
  onChange: (next: MoneySource) => void
  /** The Account tab's choices, picked in the payment-method sheet. */
  paymentMethods: PaymentMethod[]
  /** Accounts only (no cards): the Account tab unfolds these in place instead of opening the payment-method sheet. */
  accounts?: AccountView[]
  /** The Pocket tab's choices. */
  pockets: PocketVM[]
  /** Pockets this money must not come from (the pocket it is going into). */
  excludePocketIds?: readonly string[]
  onAddPocket?: () => void
  /** Rows shown above the source row, in the same group (e.g. "Into"). */
  children?: ReactNode
  /** Other words for the caption and the row's name ("Where is it?", "Kept in"); the defaults are unchanged. */
  labels?: { title?: string; from?: string; fromPocket?: string; outsideValue?: string }
  /** Account tab look: `inline` unfolds the accounts in place (default); `row` is a "From … ›" row that opens a sheet. */
  accountLook?: 'inline' | 'row'
  /** Rows shown under the source row, in the same group (e.g. "Paid", "Bought on"). */
  after?: ReactNode
  /**
   * `stacked` (default): the caption and tabs above the group. `grouped` (Fund it's "Already saved"): the caption and tabs
   * inside the group under `children`, and no row for Outside, which has nothing to pick.
   */
  look?: 'stacked' | 'grouped'
}

/**
 * "Where the money comes from": an Account · Pocket · Outside tab bar over one row that changes with the tab. Account
 * opens the payment-method sheet (or the inline account list), Pocket the pocket picker, Outside has nothing to pick.
 * Switching tabs brings back the account or pocket chosen before.
 */
export function MoneySourceField({ value, onChange, paymentMethods, accounts, pockets, excludePocketIds, onAddPocket, children, labels, accountLook = 'inline', after, look = 'stacked' }: MoneySourceFieldProps) {
  const c = { ...useLightTouchCopy().moneySource, ...labels }
  const [last, setLast] = useState<Partial<Record<MoneySourceKind, string>>>(() => (value.id ? { [value.kind]: value.id } : {}))
  const [methodSheet, setMethodSheet] = useState(false)
  const pick = (kind: MoneySourceKind, id?: string) => {
    if (id) setLast((l) => ({ ...l, [kind]: id }))
    onChange(kind === 'outside' ? { kind } : { kind, id })
  }
  const method = value.kind === 'account' ? paymentMethods.find((m) => m.id === value.id) : undefined
  const pocketChoices = excludePocketIds?.length ? pockets.filter((p) => !excludePocketIds.includes(p.account.id)) : pockets

  let row: ReactNode
  if (value.kind === 'outside') {
    row = <PickerRow label={c.from} value={<span className="text-[0.875rem] font-normal text-[var(--color-brand-text-secondary)]">{c.outsideValue}</span>} />
  } else if (value.kind === 'pocket') {
    row = <PocketPickerField look="row" label={c.fromPocket} pockets={pocketChoices} value={value.id ?? null} onChange={(id) => pick('pocket', id)} onAdd={onAddPocket} />
  } else if (accounts && accountLook === 'row') {
    row = <AccountPicker look="row" accounts={accounts} value={value.id ?? ''} onChange={(id) => pick('account', id)} label={c.from} />
  } else if (accounts) {
    row = (
      <div className="px-4">
        <AccountPicker accounts={accounts} value={value.id ?? ''} onChange={(id) => pick('account', id)} label={c.from} />
      </div>
    )
  } else {
    row = (
      <PickerRow
        label={c.from}
        onClick={() => setMethodSheet(true)}
        aria-label={method ? `${c.from}: ${accountTitle(method)}` : c.from}
        value={method ? (
          <>
            <BrandMark name={accountTitle(method)} color={accountColor(method)} size={24} logo={bankLogoForName(accountTitle(method))} />
            <span dir="auto" className="truncate">{accountTitle(method)}</span>
            {method.last4 ? <span dir="ltr" className="shrink-0 font-mono-numbers text-[var(--color-brand-text-muted)]">••{method.last4}</span> : null}
          </>
        ) : (
          <span className="text-[var(--color-brand-text-muted)]">{c.choose}</span>
        )}
      />
    )
  }

  const grouped = look === 'grouped'
  const tabs = (
    <SegmentedControl<MoneySourceKind>
      ariaLabel={c.title}
      value={value.kind}
      onChange={(kind) => {
        if (value.id) setLast((l) => ({ ...l, [value.kind]: value.id }))
        const fallback = kind === 'account' ? accounts?.[0]?.method.id : undefined
        pick(kind, kind === 'outside' ? undefined : last[kind] ?? fallback)
      }}
      options={[
        { value: 'account', label: c.tabs.account, ariaLabel: c.tabNames.account, icon: <Wallet /> },
        { value: 'pocket', label: c.tabs.pocket, ariaLabel: c.tabNames.pocket, icon: <PiggyBank /> },
        { value: 'outside', label: c.tabs.outside, ariaLabel: c.tabNames.outside, icon: <ArrowLeftRight /> },
      ]}
    />
  )

  return (
    <div>
      {grouped ? null : (
        <>
          <p className="mb-1.5 ms-1 text-xs font-semibold text-[var(--color-brand-text-secondary)]">{c.title}</p>
          {tabs}
        </>
      )}
      <Card padding="none" divide className={grouped ? 'overflow-hidden' : 'mt-2 overflow-hidden'}>
        {children}
        {grouped ? (
          <div className="px-4 pb-3 pt-3">
            <p className="mb-2 text-xs font-semibold text-[var(--color-brand-text-secondary)]">{c.title}</p>
            {tabs}
          </div>
        ) : null}
        {grouped && value.kind === 'outside' ? null : row}
        {after}
      </Card>
      {!accounts ? (
        <SelectPaymentMethodSheet
          open={methodSheet}
          value={value.kind === 'account' ? value.id ?? '' : ''}
          paymentMethods={paymentMethods}
          onSelect={(id) => pick('account', id)}
          onClose={() => setMethodSheet(false)}
        />
      ) : null}
    </div>
  )
}
