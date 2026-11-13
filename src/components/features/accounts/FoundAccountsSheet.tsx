'use client'

import { useEffect, useState } from 'react'
import { ResolveRow, ResolveSheet } from '@/components/modals/ResolveSheet'
import { setOpeningBalance } from '@/lib/accounts/actions'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { settlePrompt } from '@/lib/prompts/settle'
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
  const all = useT()
  const t = all.accountsPage
  const methods = useFinanceStore((s) => s.paymentMethods)
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  const settled = useFinanceStore((s) => s.settings.promptState)
  const dismissed = useSettingsStore((s) => s.dismissedBanners)
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

  // "Not mine" is a settled answer: it is hidden here too, on every phone, like the prompt it came from.
  const visible = found ? found.filter((f) => !settled?.[f.key] && !dismissed.includes(f.key)) : null
  const chosen = (visible ?? []).filter((f) => picked.has(f.key))
  const n = chosen.length

  const add = () => {
    for (const f of chosen) {
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
  const notMine = () => {
    for (const f of chosen) settlePrompt(f.key)
    if (chosen.length === (visible ?? []).length) onClose()
  }
  const toggle = (key: string) => setPicked((p) => { const q = new Set(p); if (q.has(key)) q.delete(key); else q.add(key); return q })

  const empty = visible !== null && visible.length === 0
  return (
    <ResolveSheet
      open={open}
      onClose={onClose}
      title={visible && visible.length > 0 ? t.accountsCount(visible.length) : t.findMyAccounts}
      primary={
        empty
          ? { label: t.addOneMyself, onPress: () => { onClose(); onManual() } }
          : { label: `${t.addAccountCta}${n > 0 ? ` (${n})` : ''}`, onPress: add, disabled: n === 0 }
      }
      secondary={visible && visible.length > 0 ? { label: all.prompts.notMine, onPress: notMine, disabled: n === 0 } : undefined}
    >
      {empty ? <p className="py-6 text-center text-sm text-[var(--color-brand-text-secondary)]">{t.emptySub}</p> : null}
      {(visible ?? []).map((f) => {
        const m = f.balance != null ? splitMoney(f.balance, f.currency ?? String(base)) : null
        return (
          <ResolveRow
            key={f.key}
            state={picked.has(f.key) ? 'selected' : 'idle'}
            onToggle={() => toggle(f.key)}
            leading={<BrandMark name={f.bank} color={PAYMENT_BRANDS[resolvePaymentBrandKey(f.bank) ?? '']?.colors[0] ?? PAYMENT_TYPE_META.bank_account.color} size={40} />}
            title={f.bank}
            sub={`•• ${f.last4}`}
            trailing={m ? <>{m.int}<span className="opacity-45">{m.dec}</span></> : t.setBalance}
            label={`${f.bank} •• ${f.last4}`}
          />
        )
      })}
    </ResolveSheet>
  )
}
