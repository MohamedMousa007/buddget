'use client'

import { useMemo, useState } from 'react'
import { Landmark, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { DetectedAccountsSheet } from '@/components/features/accounts/DetectedAccountsSheet'
import { PendingRow } from '@/components/ui/PendingRow'
import { useDetectedAccounts } from '@/hooks/useDetectedAccounts'
import { MoveMoneySheet, type MoveMode } from '@/components/features/accounts/MoveMoneySheet'
import { UnplacedSmsSheet } from '@/components/features/accounts/UnplacedSmsSheet'
import { UpdateBalanceSheet } from '@/components/features/accounts/UpdateBalanceSheet'
import { PaymentMethodSetupSheet } from '@/components/features/payments/PaymentMethodSetupSheet'
import { snoozeGap, useAccountGaps } from '@/lib/accounts/useAccountGaps'
import { useAccounts } from '@/lib/accounts/useAccounts'
import { unplacedSmsExpenses } from '@/lib/accounts/unplacedSms'
import { useNetWorth } from '@/hooks/useNetWorth'
import { useMask, useToggleHideAll } from '@/lib/privacy/useMask'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
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
  | { kind: 'edit'; id: string }
  | { kind: 'add'; cash?: boolean }
  | { kind: 'found' }
  | { kind: 'unplaced' }

/** The Wealth and Debts header row: title, count, and the page's add action at the end. */
function SectionHeader({ title, count, onAdd, addLabel }: { title: string; count: number; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      <h2 className="text-[17px] font-bold text-[var(--color-brand-text-primary)]">{title}</h2>
      <Badge variant="muted" className="min-w-[21px] px-1.5 font-mono-numbers text-[0.6875rem] font-semibold">{count}</Badge>
      {onAdd ? <Button variant="secondary" size="touch" className="ms-auto" onClick={onAdd}><Plus aria-hidden />{addLabel}</Button> : null}
    </div>
  )
}

export default function AccountsPage() {
  const all = useT()
  const t = all.accountsPage
  const model = useAccounts()
  const detected = useDetectedAccounts()
  const foundOpen = useSettingsStore((s) => s.accountsFoundOpen)
  const setFoundOpen = useSettingsStore((s) => s.setAccountsFoundOpen)
  const nw = useNetWorth()
  const { gaps, refresh } = useAccountGaps()
  const heroMasked = useMask('hero')
  const listMasked = useMask('lists')
  const { toggle } = useToggleHideAll()
  const { debts, debtPayments, expenses, settings, exchangeRates, goldPricePerGram, goldPriceAvailable } = useFinanceStore((s) => s)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const accountPrefill = useSettingsStore((s) => s.accountPrefill)
  const clearAccountPrefill = useSettingsStore((s) => s.clearAccountPrefill)

  const owed = useMemo(
    () => totalDebtRemainingInBase(debts.filter((d) => d.debtType === 'credit_card'), debtPayments, settings.baseCurrency, exchangeRates, goldPricePerGram, goldPriceAvailable, expenses),
    [debts, debtPayments, expenses, settings.baseCurrency, exchangeRates, goldPricePerGram, goldPriceAvailable],
  )

  const unplaced = useMemo(() => unplacedSmsExpenses(expenses), [expenses])
  const banks = model.accounts.filter((a) => a.method.type === 'bank_account' || a.method.type === 'prepaid_card')
  const wallets = model.accounts.filter((a) => a.method.type === 'wallet' || a.method.type === 'cash')
  const open = sheet && 'id' in sheet ? model.accounts.find((a) => a.method.id === sheet.id) : undefined
  const close = () => { setSheet(null); clearAccountPrefill(); setFoundOpen(false) }
  const foundSheetOpen = sheet?.kind === 'found' || foundOpen
  const addOpen = sheet?.kind === 'add' || accountPrefill !== null
  const addKey = accountPrefill ? `p-${accountPrefill.last4}` : sheet?.kind === 'add' ? (sheet.cash ? 'c' : 'a') : 'x'
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
        <DetectedAccountsSheet open={foundSheetOpen} onClose={close} onManual={() => setSheet({ kind: 'add' })} />
        <AddAccountSheet key={addKey} open={addOpen} prefill={accountPrefill ?? undefined} onClose={close} onAddCard={(id) => setSheet({ kind: 'card', id })} />
      </PageContainer>
    )
  }

  return (
    <div>
      <AccountsHero model={model} currency={base} netWorth={nw.netWorth} creditOwed={owed} hidden={heroMasked} onToggleHidden={toggle} />
      <PageContainer className="space-y-5 py-4">
        {detected.length > 0 ? (
          <PendingRow tone="teal" icon={Landmark} title={all.notifications.accountsLabel(detected.length)} subtitle={all.notifications.accountsHint} onPress={() => setSheet({ kind: 'found' })} />
        ) : null}
        {unplaced.length > 0 ? (
          <Card className="flex items-center gap-3 rounded-2xl">
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{t.unplacedTitle(unplaced.length)}</span>
              <span className="block text-[0.8125rem] text-[var(--color-brand-text-muted)]">{t.unplacedSub}</span>
            </span>
            <Button variant="secondary" size="touch" onClick={() => setSheet({ kind: 'unplaced' })}>{t.unplacedReview}</Button>
          </Card>
        ) : null}
        <section>
          <SectionHeader title={t.bankAccounts} count={banks.length} onAdd={() => setSheet({ kind: 'add' })} addLabel={t.addAccount} />
          {banks.length > 0 ? <Card padding="none" className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl">{banks.map(renderRow)}</Card> : null}
        </section>
        {wallets.length > 0 ? (
          <section>
            <SectionHeader title={t.walletsCash} count={wallets.length} />
            <Card padding="none" className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl">{wallets.map(renderRow)}</Card>
          </section>
        ) : null}
        {model.needsCash ? (
          <button type="button" onClick={() => setSheet({ kind: 'add', cash: true })} data-raw-button-ok="a whole-row tap target, sized by its content"
            className="flex min-h-[72px] w-full items-center gap-3.5 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 text-start">
            <BrandMark name="Cash" color="var(--color-brand-sunken)" icon={createElement(paymentTypeIcon('cash'), { className: 'size-5', 'aria-hidden': true })} />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-[var(--color-brand-text-primary)]">{t.typeCash}</span>
              <span className="block text-[0.8125rem] text-[var(--color-brand-text-muted)]">{t.addBalanceToInclude}</span>
            </span>
            <span className="text-sm font-semibold text-[var(--color-brand-primary-ink)]">{t.setBalance}</span>
          </button>
        ) : null}
      </PageContainer>

      {open ? (
        <>
          <AccountDetailSheet key={`d-${open.method.id}`} open={sheet?.kind === 'detail'} onClose={close} account={open} masked={listMasked}
            onMove={(mode) => setSheet({ kind: 'move', id: open.method.id, mode })} onUpdate={() => setSheet({ kind: 'update', id: open.method.id })}
            onAddCard={() => setSheet({ kind: 'card', id: open.method.id })} onEdit={() => setSheet({ kind: 'edit', id: open.method.id })} />
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
          <PaymentMethodSetupSheet key={`e-${open.method.id}`} open={sheet?.kind === 'edit'} editing={open.method} baseCurrency={settings.baseCurrency} nested onClose={close} />
        </>
      ) : null}
      <AddAccountSheet key={addKey} open={addOpen} prefill={accountPrefill ?? undefined} initialKind={sheet?.kind === 'add' && sheet.cash ? 'cash' : 'bank_account'} onClose={close} onAddCard={(id) => setSheet({ kind: 'card', id })} />
      <DetectedAccountsSheet open={foundSheetOpen} onClose={close} onManual={() => setSheet({ kind: 'add' })} />
      <UnplacedSmsSheet key={unplaced.length} open={sheet?.kind === 'unplaced'} onClose={close} items={unplaced} accounts={model.accounts} />
    </div>
  )
}
