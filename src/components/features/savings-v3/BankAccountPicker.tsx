'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, Wallet } from 'lucide-react'
import { ProviderPickerSheet, type ProviderPickerItem } from '@/components/features/payments/ProviderPickerSheet'
import { BrandMark } from '@/components/features/accounts/BrandMark'
import { accountColor, accountDisplayName, accountTitle, moneyFlex } from '@/components/features/accounts/accountDisplay'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { useSavingsV9Copy } from '@/lib/i18n/savingsV9Copy'
import { canHoldParts } from '@/lib/accounts/kinds'
import { groupByProvider } from '@/lib/accounts/providerGroups'
import { useAccounts, type AccountView } from '@/lib/accounts/useAccounts'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { PaymentMethod } from '@/lib/store/types'
import { tryConvertCurrency } from '@/lib/utils/currency'

const mark = (m: PaymentMethod, size: number) => <BrandMark name={accountTitle(m)} color={accountColor(m)} size={size} logo={bankLogoForName(accountTitle(m))} />
const free = (a: AccountView) => (a.balance ? moneyFlex(Math.max(0, a.balance.free), String(a.method.currency)) : String(a.method.currency))

/**
 * "In an account you already have" (final-ui v9): one row that opens the banks, wallets and cash; a provider with one
 * account picks it, one with several opens its accounts.
 */
export function BankAccountPicker({ value, onChange }: { value: PaymentMethod | null; onChange: (m: PaymentMethod) => void }) {
  const c = useSavingsV9Copy().picker
  const model = useAccounts()
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  const rates = useFinanceStore((s) => s.exchangeRates)
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState<string | null>(null)

  const groups = useMemo(() => {
    const holdable = { accounts: model.accounts.filter((a) => canHoldParts(a.method)), standaloneCards: [] }
    const g = groupByProvider(holdable, String(base), (a, from, to) => tryConvertCurrency(a, from, to, rates))
    const tag = (section: string) => (p: (typeof g.banks)[number]) => ({ key: p.key, name: p.name, accounts: p.accounts.filter((a) => canHoldParts(a.method)), section })
    return [
      ...g.banks.map(tag(c.banks)),
      ...g.wallets.map(tag(c.walletsCash)),
      ...g.cash.map((a) => ({ key: `cash:${a.method.id}`, name: accountDisplayName(a.method), accounts: [a], section: c.walletsCash })),
    ].filter((p) => p.accounts.length > 0)
  }, [model.accounts, base, rates, c])

  const items: ProviderPickerItem[] = groups.map((p) => {
    const one = p.accounts.length === 1 ? p.accounts[0] : null
    return {
      id: p.key,
      name: one ? accountDisplayName(one.method) : p.name,
      subtitle: one ? free(one) : c.nAccounts(p.accounts.length),
      glyph: mark(p.accounts[0].method, 38),
      group: p.section,
      trailing: one ? undefined : <ChevronRight aria-hidden className="size-4 text-[var(--color-brand-text-muted)] rtl:rotate-180" />,
    }
  })
  const chosen = groups.find((p) => p.key === provider)
  const accountItems: ProviderPickerItem[] = (chosen?.accounts ?? []).map((a) => ({
    id: a.method.id,
    name: accountDisplayName(a.method),
    subtitle: `${a.method.last4 ? `••${a.method.last4} · ` : ''}${free(a)}`,
    glyph: mark(a.method, 38),
  }))
  const pick = (m: PaymentMethod) => { onChange(m); setProvider(null); setOpen(false) }

  return (
    <>
      <TransactionRow
        icon={value ? mark(value, 40) : <Wallet className="size-5" aria-hidden />}
        iconBg={value ? 'transparent' : undefined}
        iconFg="var(--color-brand-text-secondary)"
        title={value ? accountDisplayName(value) : c.rowEmpty}
        subtitle={value ? c.insideIt : c.rowEmptySub}
        amount={value
          ? <span className="text-[0.84375rem] font-semibold text-[var(--color-brand-primary-ink)]">{c.change}</span>
          : <ChevronRight aria-hidden className="size-4 text-[var(--color-brand-text-muted)] rtl:rotate-180" />}
        onClick={() => setOpen(true)}
      />
      <ProviderPickerSheet
        open={open && !chosen}
        selectedId={value ? groups.find((p) => p.accounts.some((a) => a.method.id === value.id))?.key ?? null : null}
        items={items}
        title={c.title}
        subtitle={c.sub}
        zIndexClassName="z-[120]"
        onPick={(key) => {
          const p = groups.find((x) => x.key === key)
          if (!p) return
          if (p.accounts.length === 1) return pick(p.accounts[0].method)
          setProvider(key)
        }}
        onClose={() => setOpen(false)}
      />
      <ProviderPickerSheet
        open={open && !!chosen}
        selectedId={value?.id ?? null}
        items={accountItems}
        title={chosen?.name}
        subtitle={chosen ? c.pickOne(chosen.accounts.length) : undefined}
        zIndexClassName="z-[130]"
        onPick={(id) => { const a = chosen?.accounts.find((x) => x.method.id === id); if (a) pick(a.method) }}
        onClose={() => setProvider(null)}
      />
    </>
  )
}
