'use client'

import { X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
import { ExcludeSwitchRow } from '@/components/features/spending/ExcludeSwitchRow'
import { IconButton } from '@/components/ui/IconButton'
import { holdsBalance, pickablePaymentMethods } from '@/lib/accounts/kinds'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { PaymentMethod } from '@/lib/store/types'

/** How many accounts and cards are left out, for the settings row's subtitle. */
export function useNotCountedCount(): number {
  return useFinanceStore((s) => s.paymentMethods.filter((m) => m.excluded && !m.closedAt).length)
}

/** The one place to choose which accounts and cards are not yours: their spending, balance and debt leave your totals. */
export function NotCountedSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const copy = useSettingsHubCopy()
  const c = copy.notCounted
  const methods = useFinanceStore((s) => s.paymentMethods)
  const update = useFinanceStore((s) => s.updatePaymentMethod)
  const list = pickablePaymentMethods(methods)
  const accounts = list.filter((m) => holdsBalance(m.type))
  const cards = list.filter((m) => !holdsBalance(m.type))
  const parentOf = (m: PaymentMethod) => (m.parentId ? list.find((x) => x.id === m.parentId) : undefined)

  const row = (m: PaymentMethod) => {
    const parent = parentOf(m)
    const inherited = Boolean(parent?.excluded)
    const detail = inherited && parent ? c.follows(accountTitle(parent)) : m.last4 ? `•• ${m.last4}` : undefined
    return (
      <ExcludeSwitchRow key={m.id} title={accountTitle(m)} hint={detail} checked={Boolean(m.excluded) || inherited} disabled={inherited} onChange={(v) => update(m.id, { excluded: v })} />
    )
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName="z-[110]" panelClassName="md:w-[460px]" padContent>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{copy.items.notCounted.label}</h2>
          <IconButton onClick={onClose} aria-label={copy.close} variant="tinted" size="sm" shape="round"><X className="h-full w-full" /></IconButton>
        </div>
        <p className="text-sm leading-relaxed text-[var(--color-brand-text-secondary)]">{c.intro}</p>
        {list.length === 0 ? <p className="py-6 text-center text-sm text-[var(--color-brand-text-muted)]">{c.empty}</p> : null}
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          {accounts.length > 0 ? <section className="space-y-2"><h3 className="text-[13px] font-bold text-[var(--color-brand-text-secondary)]">{c.accounts}</h3>{accounts.map(row)}</section> : null}
          {cards.length > 0 ? <section className="space-y-2"><h3 className="text-[13px] font-bold text-[var(--color-brand-text-secondary)]">{c.cards}</h3>{cards.map(row)}</section> : null}
        </div>
      </div>
    </ModalShell>
  )
}
