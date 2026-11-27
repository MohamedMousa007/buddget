'use client'

import { useState } from 'react'
import { Check, ChevronDown, CreditCard } from 'lucide-react'
import { PickerRow } from '@/components/ui/PickerRow'
import { ProviderPickerSheet, type ProviderPickerItem } from '@/components/features/payments/ProviderPickerSheet'
import type { AccountView } from '@/lib/accounts/useAccounts'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { BrandMark } from './BrandMark'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { accountColor, accountDisplayName, accountSubtitle, accountTitle, moneyFlex, sharesProvider } from './accountDisplay'

interface AccountPickerProps {
  accounts: AccountView[]
  value: string
  onChange: (id: string) => void
  /** Overrides the default "From" caption (e.g. "To account"). */
  label?: string
  /** Adds a first "none" row with this text; `value` '' selects it. Absent = an account is always chosen. */
  noneLabel?: string
  /** Free-balance column on each row. Default on. */
  showBalance?: boolean
  /** `row` (Light touch): a `PickerRow` in a grouped list that opens a searchable sheet of the accounts. Default `inline`. */
  look?: 'inline' | 'row'
  /** Row look: the sheet's title (defaults to the label). */
  title?: string
  /** Row look: stacked over another nested sheet. */
  zIndexClassName?: string
}

/** The account's name and its digits, apart, as a row value shows them ("CIB Current ••1234"). */
export function AccountNameValue({ method }: { method: AccountView['method'] }) {
  const name = accountDisplayName(method)
  return (
    <>
      <BrandMark name={accountTitle(method)} color={accountColor(method)} size={24} logo={bankLogoForName(accountTitle(method))} />
      <span dir="auto" className="truncate">{name}</span>
      {method.last4 ? <span dir="ltr" className="shrink-0 font-mono-numbers text-[var(--color-brand-text-muted)]">{'\u2022\u2022'}{method.last4}</span> : null}
    </>
  )
}

/** "From": the chosen account on one row; tap to unfold the rest in place (no second sheet). */
export function AccountPicker(props: AccountPickerProps) {
  return props.look === 'row' ? <AccountPickerRow {...props} /> : <AccountPickerInline {...props} />
}

const NONE = '__none'

function AccountPickerRow({ accounts, value, onChange, label, noneLabel, showBalance = true, title, zIndexClassName }: AccountPickerProps) {
  const t = useT().accountsPage
  const [open, setOpen] = useState(false)
  const current = accounts.find((a) => a.method.id === value) ?? (noneLabel !== undefined ? undefined : accounts[0])
  const methods = accounts.map((a) => a.method)
  const items: ProviderPickerItem[] = [
    ...(noneLabel !== undefined ? [{ id: NONE, name: noneLabel, glyph: <BrandMark name="" color="var(--color-brand-sunken)" size={38} icon={<CreditCard className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden />} /> }] : []),
    ...accounts.map((a) => ({
      id: a.method.id,
      name: accountDisplayName(a.method),
      subtitle: accountSubtitle({ ...a.method, label: undefined }, sharesProvider(a.method, methods)) ?? String(a.method.currency),
      glyph: <BrandMark name={accountTitle(a.method)} color={accountColor(a.method)} size={38} logo={bankLogoForName(accountTitle(a.method))} />,
      trailing: showBalance && a.balance ? <span className="font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{moneyFlex(Math.max(0, a.balance.free), String(a.method.currency))}</span> : undefined,
    })),
  ]
  return (
    <>
      <PickerRow label={label ?? t.from} onClick={() => setOpen(true)}
        value={current ? <AccountNameValue method={current.method} /> : <span className="text-[var(--color-brand-text-muted)]">{noneLabel}</span>} />
      <ProviderPickerSheet open={open} selectedId={current?.method.id ?? NONE} items={items} title={title ?? label ?? t.from} zIndexClassName={zIndexClassName}
        onPick={(id) => { onChange(id === NONE ? '' : id); setOpen(false) }} onClose={() => setOpen(false)} />
    </>
  )
}

function AccountPickerInline({ accounts, value, onChange, label, noneLabel, showBalance = true }: AccountPickerProps) {
  const t = useT().accountsPage
  const [open, setOpen] = useState(false)
  const found = accounts.find((a) => a.method.id === value)
  const current = found ?? (noneLabel !== undefined ? null : accounts[0])
  if (!current && noneLabel === undefined) return null
  const methods = accounts.map((a) => a.method)
  const freeText = (a: AccountView) => (a.balance ? t.freeLabel(`${moneyFlex(Math.max(0, a.balance.free), String(a.method.currency))} ${String(a.method.currency)}`) : t.setBalance)
  // The user's Name leads (as on Accounts); the line under it carries the digits, never the Name a second time.
  const subtitle = (a: AccountView) => accountSubtitle({ ...a.method, label: undefined }, sharesProvider(a.method, methods)) ?? String(a.method.currency)
  const noneMark = <BrandMark name="" color="var(--color-brand-sunken)" size={36} icon={<CreditCard className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden />} />
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-raw-button-ok="the collapsed row of an inline picker"
        className="flex min-h-[52px] w-full items-center gap-3 text-start">
        {current ? <BrandMark name={accountTitle(current.method)} color={accountColor(current.method)} size={36} logo={bankLogoForName(accountTitle(current.method))} /> : noneMark}
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-[var(--color-brand-text-muted)]">{label ?? t.from}</span>
          <span className="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{current ? accountDisplayName(current.method) : noneLabel}</span>
          {current && !showBalance ? <span dir="ltr" className="block truncate text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{subtitle(current)}</span> : null}
        </span>
        {current && showBalance ? <span className="font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{freeText(current)}</span> : null}
        <ChevronDown className={cn('size-5 text-[var(--color-brand-text-muted)] transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open ? (
        <div role="listbox" className="mb-2 mt-1 divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]">
          {noneLabel !== undefined ? (
            <button type="button" role="option" aria-selected={!current}
              onClick={() => { onChange(''); setOpen(false) }} data-raw-button-ok="a row inside the unfolded picker list"
              className="flex min-h-14 w-full items-center gap-3 px-3.5 text-start">
              <BrandMark name="" color="var(--color-brand-sunken)" size={32} icon={<CreditCard className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden />} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{noneLabel}</span>
              {!current ? <Check className="size-4 text-[var(--color-brand-primary-ink)]" aria-hidden /> : null}
            </button>
          ) : null}
          {accounts.map((a) => (
            <button key={a.method.id} type="button" role="option" aria-selected={a.method.id === current?.method.id}
              onClick={() => { onChange(a.method.id); setOpen(false) }} data-raw-button-ok="a row inside the unfolded picker list"
              className="flex min-h-14 w-full items-center gap-3 px-3.5 text-start">
              <BrandMark name={accountTitle(a.method)} color={accountColor(a.method)} size={32} logo={bankLogoForName(accountTitle(a.method))} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{accountDisplayName(a.method)}</span>
                <span dir="ltr" className="block truncate text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{subtitle(a)}</span>
              </span>
              {showBalance ? <span className="font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{freeText(a)}</span> : null}
              {a.method.id === current?.method.id ? <Check className="size-4 text-[var(--color-brand-primary-ink)]" aria-hidden /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
