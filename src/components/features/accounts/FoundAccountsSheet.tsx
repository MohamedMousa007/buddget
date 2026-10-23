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

interface Found {
  key: string
  bank: string
  last4: string
  balance: number | null
  receivedAt: string | null
}

/** Accounts the bank messages already mention, grouped by (bank, last 4). Nothing is read from the inbox here. */
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
      .select('bank_name, account_last4, balance_after, received_at')
      .not('bank_name', 'is', null).not('account_last4', 'is', null)
      .order('received_at', { ascending: false }).limit(300)
      .then(({ data }) => {
        if (off) return
        const seen = new Map<string, Found>()
        for (const r of data ?? []) {
          const key = `${r.bank_name}|${r.account_last4}`
          const prev = seen.get(key)
          if (!prev) seen.set(key, { key, bank: r.bank_name!, last4: r.account_last4!, balance: r.balance_after, receivedAt: r.balance_after != null ? r.received_at : null })
          else if (prev.balance == null && r.balance_after != null) { prev.balance = r.balance_after; prev.receivedAt = r.received_at }
        }
        const have = new Set(methods.map((m) => m.last4).filter(Boolean))
        const list = [...seen.values()].filter((f) => !have.has(f.last4))
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
      const type = brand?.type === 'wallet' ? 'wallet' : 'bank_account'
      const id = addPaymentMethod({
        name: composePaymentMethodName(brand?.name ?? f.bank, { last4: f.last4 }), type, currency: base, isDefault: false,
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
            const m = f.balance != null ? splitMoney(f.balance, String(base)) : null
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
