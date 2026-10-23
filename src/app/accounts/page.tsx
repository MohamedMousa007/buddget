'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { AppLink } from '@/components/ui/AppLink'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageContainer } from '@/components/layout/PageContainer'
import { AccountsHero } from '@/components/features/accounts/AccountsHero'
import { AccountRow } from '@/components/features/accounts/AccountRow'
import { AccountDetailSheet } from '@/components/features/accounts/AccountDetailSheet'
import { AddAccountSheet } from '@/components/features/accounts/AddAccountSheet'
import { BrandMark } from '@/components/features/accounts/BrandMark'
import { FixGapSheet } from '@/components/features/accounts/FixGapSheet'
import { FoundAccountsSheet } from '@/components/features/accounts/FoundAccountsSheet'
import { MoveMoneySheet, type MoveMode } from '@/components/features/accounts/MoveMoneySheet'
import { UpdateBalanceSheet } from '@/components/features/accounts/UpdateBalanceSheet'
import { splitMoney } from '@/components/features/accounts/accountDisplay'
import { PaymentMethodSetupSheet } from '@/components/features/payments/PaymentMethodSetupSheet'
import { snoozeGap, useAccountGaps } from '@/lib/accounts/useAccountGaps'
import { useAccounts } from '@/lib/accounts/useAccounts'
import { useNetWorth } from '@/hooks/useNetWorth'
import { MASK } from '@/lib/privacy/mask'
import { useMask, useToggleHideAll } from '@/lib/privacy/useMask'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { totalDebtRemainingInBase } from '@/lib/utils/calculations'
import { useT } from '@/lib/i18n'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { createElement } from 'react'

type Sheet =
  | { kind: 'detail'; id: string }
  | { kind: 'move'; id: string; mode: MoveMode; amount?: string; fromGap?: boolean }
  | { kind: 'update'; id: string }
  | { kind: 'fix'; id: string }
  | { kind: 'card'; id: string }
  | { kind: 'add'; cash?: boolean }
  | { kind: 'found' }

export default function AccountsPage() {
  const t = useT().accountsPage
  const model = useAccounts()
  const nw = useNetWorth()
  const { gaps, refresh } = useAccountGaps()
  const heroMasked = useMask('hero')
  const listMasked = useMask('lists')
  const { toggle } = useToggleHideAll()
  const { debts, debtPayments, expenses, settings, exchangeRates, goldPricePerGram, goldPriceAvailable } = useFinanceStore((s) => s)
  const [sheet, setSheet] = useState<Sheet | null>(null)

  const owed = useMemo(
    () => totalDebtRemainingInBase(debts.filter((d) => d.debtType === 'credit_card'), debtPayments, settings.baseCurrency, exchangeRates, goldPricePerGram, goldPriceAvailable, expenses),
    [debts, debtPayments, expenses, settings.baseCurrency, exchangeRates, goldPricePerGram, goldPriceAvailable],
  )

  const banks = model.accounts.filter((a) => a.method.type === 'bank_account' || a.method.type === 'prepaid_card')
  const wallets = model.accounts.filter((a) => a.method.type === 'wallet' || a.method.type === 'cash')
  const open = sheet && 'id' in sheet ? model.accounts.find((a) => a.method.id === sheet.id) : undefined
  const close = () => setSheet(null)
  const base = String(settings.baseCurrency)

  const renderRow = (a: (typeof model.accounts)[number]) => (
    <AccountRow key={a.method.id} account={a} masked={listMasked} gap={gaps[a.method.id]?.amount}
      onOpen={() => setSheet(a.balance ? { kind: 'detail', id: a.method.id } : { kind: 'update', id: a.method.id })}
      onFix={() => setSheet({ kind: 'fix', id: a.method.id })}
      onAddCard={() => setSheet({ kind: 'card', id: a.method.id })} />
  )

  if (model.accounts.length === 0) {
    return (
      <PageContainer>
        <EmptyState className="min-h-[60vh]" title={t.emptyTitle} description={t.emptySub}
          action={<div className="flex w-full max-w-xs flex-col gap-2">
            <Button size="cta-block" onClick={() => setSheet({ kind: 'found' })} className="font-semibold">{t.findMyAccounts}</Button>
            <Button variant="outline" size="cta-block" onClick={() => setSheet({ kind: 'add' })}>{t.addOneMyself}</Button>
          </div>} />
        <FoundAccountsSheet open={sheet?.kind === 'found'} onClose={close} onManual={() => setSheet({ kind: 'add' })} />
        <AddAccountSheet key={sheet?.kind === 'add' ? 'a' : 'x'} open={sheet?.kind === 'add'} onClose={close} />
      </PageContainer>
    )
  }

  return (
    <div>
      <AccountsHero model={model} currency={base} netWorth={nw.netWorth} creditOwed={owed} hidden={heroMasked} onToggleHidden={toggle} />
      <PageContainer className="space-y-5 py-4">
        {banks.length > 0 ? (
          <section>
            <p className="mb-2 px-1 text-[13px] font-bold text-[var(--color-brand-text-secondary)]">{t.bankAccounts}</p>
            <Card padding="none" className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl">{banks.map(renderRow)}</Card>
          </section>
        ) : null}
        {wallets.length > 0 ? (
          <section>
            <p className="mb-2 px-1 text-[13px] font-bold text-[var(--color-brand-text-secondary)]">{t.walletsCash}</p>
            <Card padding="none" className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl">{wallets.map(renderRow)}</Card>
          </section>
        ) : null}
        <AppLink href="/debts" className="flex min-h-16 items-center gap-3.5 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4">
          <BrandMark name="Debts" color="var(--color-cat-6)" icon={createElement(paymentTypeIcon('credit_card'), { className: 'size-5', 'aria-hidden': true })} />
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-[var(--color-brand-text-primary)]">{t.creditAndDebts}</span>
            <span className="block text-[13px] text-[var(--color-brand-text-muted)]">{t.creditAndDebtsSub}</span>
          </span>
          <span className="font-mono-numbers text-base font-medium">{listMasked ? MASK : splitMoney(owed, base).int}</span>
          <ChevronRight className="size-4 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
        </AppLink>
        {model.needsCash ? (
          <button type="button" onClick={() => setSheet({ kind: 'add', cash: true })} data-raw-button-ok="a whole-row tap target, sized by its content"
            className="flex min-h-[72px] w-full items-center gap-3.5 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 text-start">
            <BrandMark name="Cash" color="var(--color-brand-sunken)" icon={createElement(paymentTypeIcon('cash'), { className: 'size-5', 'aria-hidden': true })} />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-[var(--color-brand-text-primary)]">{t.typeCash}</span>
              <span className="block text-[13px] text-[var(--color-brand-text-muted)]">{t.addBalanceToInclude}</span>
            </span>
            <span className="text-sm font-semibold text-[var(--color-brand-primary-ink)]">{t.setBalance}</span>
          </button>
        ) : null}
        <Button variant="outline" size="cta-block" onClick={() => setSheet({ kind: 'add' })} className="border-dashed text-[var(--color-brand-primary-ink)]">
          <Plus aria-hidden />{t.addAccountOrCard}
        </Button>
      </PageContainer>

      {open ? (
        <>
          <AccountDetailSheet key={`d-${open.method.id}`} open={sheet?.kind === 'detail'} onClose={close} account={open} masked={listMasked}
            onMove={(mode) => setSheet({ kind: 'move', id: open.method.id, mode })} onUpdate={() => setSheet({ kind: 'update', id: open.method.id })}
            onAddCard={() => setSheet({ kind: 'card', id: open.method.id })} />
          <MoveMoneySheet key={`m-${open.method.id}-${sheet?.kind === 'move' ? sheet.mode : ''}`} open={sheet?.kind === 'move'} onClose={close}
            accounts={model.accounts} initialAccountId={open.method.id} initialMode={sheet?.kind === 'move' ? sheet.mode : 'cash'} initialAmount={sheet?.kind === 'move' ? sheet.amount : undefined}
            onDone={() => { const g = gaps[open.method.id]; if (g && sheet?.kind === 'move' && sheet.fromGap) { snoozeGap(open.method.id, g.reportedAt); refresh() } }} />
          <UpdateBalanceSheet key={`u-${open.method.id}`} open={sheet?.kind === 'update'} onClose={close} account={open}
            onDone={() => { const g = gaps[open.method.id]; if (g) { snoozeGap(open.method.id, g.reportedAt); refresh() } }} />
          {gaps[open.method.id] ? (
            <FixGapSheet key={`f-${open.method.id}`} open={sheet?.kind === 'fix'} onClose={close} account={open} gap={gaps[open.method.id]}
              onSetAside={(amount) => setSheet({ kind: 'move', id: open.method.id, mode: 'set', amount: String(amount), fromGap: true })} onResolved={refresh} />
          ) : null}
          <PaymentMethodSetupSheet open={sheet?.kind === 'card'} editing={null} baseCurrency={settings.baseCurrency} parentAccountId={open.method.id} nested onClose={close} />
        </>
      ) : null}
      <AddAccountSheet key={sheet?.kind === 'add' ? (sheet.cash ? 'c' : 'a') : 'x'} open={sheet?.kind === 'add'} initialKind={sheet?.kind === 'add' && sheet.cash ? 'cash' : 'bank_account'} onClose={close} />
      <FoundAccountsSheet open={sheet?.kind === 'found'} onClose={close} onManual={() => setSheet({ kind: 'add' })} />
    </div>
  )
}
