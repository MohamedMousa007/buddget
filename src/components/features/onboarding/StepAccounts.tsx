'use client'

import { useState } from 'react'
import { Info, Landmark, Plus, Smartphone, Wallet } from 'lucide-react'
import { AddAccountSheet } from '@/components/features/accounts/AddAccountSheet'
import { BrandMark } from '@/components/features/accounts/BrandMark'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { OptionChip } from '@/components/ui/OptionChip'
import { useAccounts } from '@/lib/accounts/useAccounts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { BuddgyHead, stepLead, stepTitle } from './BuddgyHead'
import type { StepChrome } from './chrome'
import { JourneyFrame } from './JourneyFrame'
import { BandBar, RevealScreen } from './RevealScreen'
import { useOnboardingCopy } from './useOnboardingCopy'

type Kind = 'bank_account' | 'wallet' | 'cash'

const SHARE_COLORS = ['var(--color-brand-primary-bright)', 'var(--color-brand-gold)', 'var(--color-brand-amber)', 'var(--color-brand-text-muted)']
const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

/** Step 3: where the money lives. Reuses the Accounts add sheet, then reveals the first real number. */
export function StepAccounts({ chrome }: { chrome: StepChrome }) {
  const c = useOnboardingCopy()
  const model = useAccounts()
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  const name = useFinanceStore((s) => s.profile.name)
  const rates = useFinanceStore((s) => s.exchangeRates)
  const [adding, setAdding] = useState<Kind | null>(null)
  const [reveal, setReveal] = useState(false)

  const rows = model.accounts
  const withBalance = rows.filter((a) => a.balance)

  if (reveal) {
    // Each account's share in the base currency, so a dollar account is not weighed as dirhams.
    const inBase = withBalance.map((a) => Math.max(0, tryConvertCurrency(a.balance!.balance, a.balance!.currency, base, rates) ?? a.balance!.balance))
    const total = inBase.reduce((sum, n) => sum + n, 0)
    const shares = total > 0 ? inBase.map((n) => n / total) : [1]
    return (
      <RevealScreen
        chrome={{ ...chrome, onBack: () => setReveal(false) }}
        label={c.accounts.revealLabel(rows.length)}
        chip={c.accounts.revealChip}
        big={fmt(model.totalInBase)}
        unit={base}
        bar={<BandBar parts={shares.map((share, i) => ({ share, color: SHARE_COLORS[i % SHARE_COLORS.length] }))} />}
        cells={[
          { label: c.accounts.addBank, value: String(rows.filter((a) => a.method.type === 'bank_account').length) },
          { label: c.accounts.addWallet, value: String(rows.filter((a) => a.method.type === 'wallet').length) },
          { label: c.accounts.addCash, value: String(rows.filter((a) => a.method.type === 'cash').length) },
        ]}
        title={c.accounts.revealTitle(name)}
        lead={c.accounts.revealLead}
        onContinue={chrome.next}
      />
    )
  }

  return (
    <JourneyFrame
      {...chrome}
      footer={
        <>
          <Button size="cta" className="w-full" onClick={() => (rows.length > 0 ? setReveal(true) : chrome.next())} disabled={rows.length === 0}>
            {c.cont}
          </Button>
          <Button variant="ghost" size="touch" className="w-full" onClick={chrome.next}>
            {c.accounts.later}
          </Button>
        </>
      }
    >
      <BuddgyHead mood="curious" size={52} />
      <h1 className={`${stepTitle} mt-[18px]`}>{c.accounts.title}</h1>
      <p className={stepLead}>{c.accounts.lead}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <OptionChip as="trigger" size="md" onClick={() => setAdding('cash')}><Wallet aria-hidden />{c.accounts.addCash}</OptionChip>
        <OptionChip as="trigger" size="md" onClick={() => setAdding('bank_account')}><Landmark aria-hidden />{c.accounts.addBank}</OptionChip>
        <OptionChip as="trigger" size="md" onClick={() => setAdding('wallet')}><Smartphone aria-hidden />{c.accounts.addWallet}</OptionChip>
      </div>

      {rows.length === 0 ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-[var(--color-brand-text-muted)]"><Plus className="size-4" aria-hidden />{c.accounts.empty}</p>
      ) : (
        <Card padding="none" className="mt-5 divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl">
          {rows.map((a) => (
            <div key={a.method.id} className="flex min-h-16 items-center gap-3.5 px-4 py-2.5">
              <BrandMark name={a.method.name} color={a.method.color ?? '#566B68'} size={40} />
              <span className="min-w-0 flex-1 truncate text-base font-semibold text-[var(--color-brand-text-primary)]">{a.method.name}</span>
              <span className="font-mono-numbers text-base font-medium">{a.balance ? formatCurrency(a.balance.balance, a.balance.currency, false) : '-'}</span>
            </div>
          ))}
        </Card>
      )}

      <p className="mt-3.5 flex items-start gap-2 text-[12.5px] leading-snug text-[var(--color-brand-text-muted)]">
        <Info className="mt-px size-4 shrink-0" aria-hidden />
        {c.accounts.why}
      </p>

      {adding ? <AddAccountSheet key={adding} open initialKind={adding} onClose={() => setAdding(null)} /> : null}
    </JourneyFrame>
  )
}
