'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { setOpeningBalance } from '@/lib/accounts/actions'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { PAYMENT_BRANDS, PAYMENT_TYPE_META, composePaymentMethodName, resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import { BrandMark } from './BrandMark'
import { splitMoney } from './accountDisplay'
import { tailsMatch } from '@/lib/accounts/identity/accountRef'
import { detectAccounts, pickProvider, type Row } from '@/hooks/usePaymentMethodDetector'
import type { Currency, PaymentMethodType } from '@/lib/store/types'

interface Found {
  key: string
  bank: string
  last4: string
  type: PaymentMethodType | null
  balance: number | null
  receivedAt: string | null
  /** Currency the message states; a balance in another currency is not an opening balance in the base currency. */
  currency: string | null
}

/** Accounts the bank messages already mention (one per bank and number). Nothing is read from the inbox here. */
export function FoundAccountsSheet({ open, onClose, onManual }: { open: boolean; onClose: () => void; onManual: () => void }) {
  const t = useT().accountsPage
  const methods = useFinanceStore((s) => s.paymentMethods)
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  const addPaymentMethod = useFinanceStore((s) => s.addPaymentMethod)
  const [found, setFound] = useState<Found[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    let off = false
    void createClient().from('sms_parse_log')
      .select('bank_name, sender, payment_instrument, raw_body, account_last4, balance_after, received_at')
      .not('account_last4', 'is', null)
      .order('received_at', { ascending: false }).limit(300)
      .then(({ data }) => {
        if (off) return
        const rows = data ?? []
        // Same grouping as the detection prompt: per bank, one account printed as 001 and 0001 is one, cards belong under an account.
        const list: Found[] = detectAccounts(rows as Row[], methods)
          .filter((a) => a.type !== 'debit_card' && a.type !== 'credit_card' && a.type !== 'prepaid_card')
          .map((a) => {
            const withBalance = rows.find((r) => r.balance_after != null && tailsMatch(r.account_last4, a.last4) && pickProvider(r.sender, r.bank_name) === a.provider)
            return {
              key: a.key, bank: a.provider ?? 'Bank', last4: a.last4, type: a.type,
              balance: withBalance?.balance_after ?? null, receivedAt: withBalance?.received_at ?? null, currency: a.currency,
            }
          })
        setFound(list)
        setPicked(new Set(list.map((f) => f.key)))
      })
    return () => { off = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const add = () => {
    for (const f of found ?? []) {
      if (!picked.has(f.key)) continue
      const brand = PAYMENT_BRANDS[resolvePaymentBrandKey(f.bank) ?? '']
      const type = brand?.type === 'wallet' || f.type === 'wallet' ? 'wallet' : 'bank_account'
      const accountCurrency = (f.currency ?? String(base)) as Currency
      const id = addPaymentMethod({
        name: composePaymentMethodName(brand?.name ?? f.bank, { last4: f.last4 }), type, currency: accountCurrency, isDefault: false,
        color: brand?.colors[0] ?? PAYMENT_TYPE_META[type].color, last4: f.last4,
      })
      if (f.balance != null && f.receivedAt) setOpeningBalance(id, f.balance, new Date(f.receivedAt))
    }
    onClose()
  }

  const n = picked.size
  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{found && found.length > 0 ? t.accountsCount(found.length) : t.findMyAccounts}</V3SheetHeader.Title>
        </V3SheetHeader>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-3 pt-2">
          {found && found.length === 0 ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-[var(--color-brand-text-secondary)]">{t.emptySub}</p>
              <Button variant="outline" size="cta-block" onClick={() => { onClose(); onManual() }}>{t.addOneMyself}</Button>
            </div>
          ) : null}
          {(found ?? []).map((f) => {
            const on = picked.has(f.key)
            const m = f.balance != null ? splitMoney(f.balance, f.currency ?? String(base)) : null
            return (
              <SelectableCard key={f.key} selected={on} role="checkbox" aria-checked={on}
                onClick={() => setPicked((p) => { const q = new Set(p); if (on) q.delete(f.key); else q.add(f.key); return q })}>
                <BrandMark name={f.bank} color={PAYMENT_BRANDS[resolvePaymentBrandKey(f.bank) ?? '']?.colors[0] ?? PAYMENT_TYPE_META.bank_account.color} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{f.bank}</span>
                  <span className="block text-xs text-[var(--color-brand-text-muted)]">•• {f.last4}</span>
                </span>
                <span className="font-mono-numbers text-sm font-medium">{m ? <>{m.int}<span className="opacity-45">{m.dec}</span></> : t.setBalance}</span>
                {on ? <Check className="size-4 text-[var(--color-brand-primary-ink)]" aria-hidden /> : null}
              </SelectableCard>
            )
          })}
        </div>
        {found && found.length > 0 ? (
          <div className="px-5 pb-5 pt-2">
            <Button size="cta-block" onClick={add} disabled={n === 0} className="font-semibold">{t.addAccountCta}{n > 0 ? ` (${n})` : ''}</Button>
          </div>
        ) : null}
      </div>
    </ModalShell>
  )
}
