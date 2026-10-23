'use client'

import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { AccountView } from '@/lib/accounts/useAccounts'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { BrandMark } from './BrandMark'
import { accountColor, accountTitle, splitMoney } from './accountDisplay'

interface AccountPickerProps {
  accounts: AccountView[]
  value: string
  onChange: (id: string) => void
}

/** "From": the chosen account on one row; tap to unfold the rest in place (no second sheet). */
export function AccountPicker({ accounts, value, onChange }: AccountPickerProps) {
  const t = useT().accountsPage
  const [open, setOpen] = useState(false)
  const current = accounts.find((a) => a.method.id === value) ?? accounts[0]
  if (!current) return null
  const freeText = (a: AccountView) => (a.balance ? t.freeLabel(splitMoney(a.balance.free, String(a.method.currency)).int) : t.setBalance)
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-raw-button-ok="the collapsed row of an inline picker"
        className="flex min-h-[52px] w-full items-center gap-3 text-start">
        <BrandMark name={accountTitle(current.method)} color={accountColor(current.method)} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-[var(--color-brand-text-muted)]">{t.from}</span>
          <span className="block truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{accountTitle(current.method)}</span>
        </span>
        <span className="font-mono-numbers text-[13px] text-[var(--color-brand-text-secondary)]">{freeText(current)}</span>
        <ChevronDown className={cn('size-5 text-[var(--color-brand-text-muted)] transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open ? (
        <div role="listbox" className="mb-2 mt-1 divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]">
          {accounts.map((a) => (
            <button key={a.method.id} type="button" role="option" aria-selected={a.method.id === current.method.id}
              onClick={() => { onChange(a.method.id); setOpen(false) }} data-raw-button-ok="a row inside the unfolded picker list"
              className="flex min-h-14 w-full items-center gap-3 px-3.5 text-start">
              <BrandMark name={accountTitle(a.method)} color={accountColor(a.method)} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{accountTitle(a.method)}</span>
                {a.method.last4 ? <span className="block text-xs text-[var(--color-brand-text-muted)]">•• {a.method.last4}</span> : null}
              </span>
              <span className="font-mono-numbers text-[13px] text-[var(--color-brand-text-secondary)]">{freeText(a)}</span>
              {a.method.id === current.method.id ? <Check className="size-4 text-[var(--color-brand-primary-ink)]" aria-hidden /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
