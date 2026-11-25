'use client'

import { useEffect, useMemo, useState } from 'react'
import { Archive, Landmark, MoreVertical, Plus, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { IconButton } from '@/components/ui/IconButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageContainer } from '@/components/layout/PageContainer'
import { AccountsHero } from '@/components/features/accounts/AccountsHero'
import { AccountRow } from '@/components/features/accounts/AccountRow'
import { CardRow } from '@/components/features/accounts/CardRow'
import { ProviderCard } from '@/components/features/accounts/ProviderCard'
import { ProviderHero } from '@/components/features/accounts/ProviderHero'
import { RateAlert } from '@/components/features/accounts/RateAlert'
import { accountTitle, sharesProvider, splitMoney } from '@/components/features/accounts/accountDisplay'
import { AccountDetailSheet } from '@/components/features/accounts/AccountDetailSheet'
import { AddAccountSheet } from '@/components/features/accounts/AddAccountSheet'
import { CashCurrencySheet } from '@/components/features/accounts/CashCurrencySheet'
import { BrandMark } from '@/components/features/accounts/BrandMark'
import { FixGapSheet } from '@/components/features/accounts/FixGapSheet'
import { DetectedAccountsSheet } from '@/components/features/accounts/DetectedAccountsSheet'
import { PendingRow } from '@/components/ui/PendingRow'
import { useDetectedAccounts } from '@/hooks/useDetectedAccounts'
import { MoveMoneySheet, type MoveMode } from '@/components/features/accounts/MoveMoneySheet'
import { UnplacedSmsSheet } from '@/components/features/accounts/UnplacedSmsSheet'
import { CardDetailSheet } from '@/components/features/accounts/CardDetailSheet'
import { PaymentMethodSetupSheet } from '@/components/features/payments/PaymentMethodSetupSheet'
import { ensureCashAccount } from '@/lib/accounts/actions'
import { cardDetails } from '@/lib/accounts/cardDetails'
import { holdsBalance } from '@/lib/accounts/kinds'
import { groupByProvider, providerKeyOf, type ProviderFace, type ProviderGroup } from '@/lib/accounts/providerGroups'
import { snoozeGap, useAccountGaps } from '@/lib/accounts/useAccountGaps'
import { useAccounts, type AccountView } from '@/lib/accounts/useAccounts'
import { cashAccountId } from '@/lib/accounts/resolve'
import { hasLiveRate } from '@/lib/market/rateFreshness'
import { useRates } from '@/hooks/useRates'
import { unplacedSmsExpenses } from '@/lib/accounts/unplacedSms'
import { useNetWorth } from '@/hooks/useNetWorth'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { useMask, useToggleHideAll } from '@/lib/privacy/useMask'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { PaymentMethod } from '@/lib/store/types'
import { totalDebtRemainingInBase } from '@/lib/utils/calculations'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { useT } from '@/lib/i18n'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { createElement } from 'react'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'

/** A sheet stacked over the account or card sheet, which scales back behind it. */
type Over = { kind: 'addCard' } | { kind: 'card'; cardId: string } | { kind: 'editCard'; cardId: string }

const NOT_FX = new Set(['XAU', 'BTC', 'ETH'])

type Sheet =
  | { kind: 'detail'; id: string }
  | { kind: 'move'; id: string; mode: MoveMode; amount?: string; fromGap?: boolean }
  | { kind: 'fix'; id: string }
  | { kind: 'card'; id: string }
  | { kind: 'edit'; id: string }
  | { kind: 'cashCurrency'; id: string }
  /** One card on its own (a face, a credit row, an Other cards row). */
  | { kind: 'cardSheet'; cardId: string }
  /** "+ Add card" in Other cards: the card form with no parent account. */
  | { kind: 'addCard' }
  | { kind: 'add' }
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
  const [over, setOver] = useState<Over | null>(null)
  const rateFetchedAt = useFinanceStore((s) => s.rateFetchedAt)
  const { settled: ratesSettled } = useRates()
  const [openedAt] = useState(() => Date.now())
  const [cashMenu, setCashMenu] = useState<DOMRect | null>(null)
  const [providerKey, setProviderKey] = useState<string | null>(null)
  const [rateDismissed, setRateDismissed] = useState(false)
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)
  // The built-in Cash's seeded mark is not a choice (BUD-87), so only a real Cash row counts as already the default.
  const cashIsDefault = paymentMethods.some((m) => m.type === 'cash' && m.isDefault && m.id !== DEFAULT_CASH_ID && !m.closedAt)
  const accountPrefill = useSettingsStore((s) => s.accountPrefill)
  const clearAccountPrefill = useSettingsStore((s) => s.clearAccountPrefill)
  const base = String(settings.baseCurrency)

  const owed = useMemo(
    () => totalDebtRemainingInBase(debts.filter((d) => d.debtType === 'credit_card'), debtPayments, settings.baseCurrency, exchangeRates, goldPricePerGram, goldPriceAvailable, expenses),
    [debts, debtPayments, expenses, settings.baseCurrency, exchangeRates, goldPricePerGram, goldPriceAvailable],
  )
  const groups = useMemo(
    () => groupByProvider(model, base, (a, from, to) => tryConvertCurrency(a, from, to, exchangeRates)),
    [model, base, exchangeRates],
  )
  // Live rates must always exist: a currency today's fetch did not price is an error, even though the built-in table
  // still converts it for the totals. One rule for the alert and the rows' "No rate today".
  // Gold and crypto are priced elsewhere, never by the FX feed.
  const noRate = (cur: string) => ratesSettled && !NOT_FX.has(cur) && !hasLiveRate(cur, base, rateFetchedAt ?? {}, openedAt)
  const missingRates = [...new Set(model.accounts.filter((a) => a.balance && !a.method.excluded).map((a) => String(a.method.currency)))].filter(noRate).sort()
  // The ≈ stays on every total that includes a currency with no live rate, even while the fallback table converts it.
  const approxGroup = (g: ProviderGroup): ProviderGroup => (!g.approx && g.accounts.some((a) => a.balance && missingRates.includes(String(a.method.currency))) ? { ...g, approx: true } : g)

  const unplaced = useMemo(() => unplacedSmsExpenses(expenses), [expenses])
  const provider = providerKey ? [...groups.banks, ...groups.wallets].find((g) => g.key === providerKey) : undefined
  const providerOpen = provider !== undefined
  // Cash that is not tracked yet is no account in the list; its sheet opens with the pad (BUD-87 keeps its default).
  const cashId = cashAccountId(paymentMethods)
  const cashMethod = model.needsCash && cashId ? paymentMethods.find((m) => m.id === cashId) : undefined
  const viewOf = (id: string): AccountView | undefined =>
    model.accounts.find((a) => a.method.id === id) ?? (cashMethod && cashMethod.id === id ? { method: cashMethod, cards: [], balance: null } : undefined)
  const open = sheet && 'id' in sheet ? viewOf(sheet.id) : undefined
  const sheetCard = sheet?.kind === 'cardSheet' ? paymentMethods.find((m) => m.id === sheet.cardId) : undefined
  const overCard = over && 'cardId' in over ? paymentMethods.find((m) => m.id === over.cardId) : undefined
  // Card sheets stay mounted on their last card after closing, so ModalShell can play its exit animation.
  const [shownSheetCardId, setShownSheetCardId] = useState<string | null>(null)
  if (sheetCard && sheetCard.id !== shownSheetCardId) setShownSheetCardId(sheetCard.id)
  const [shownOverCardId, setShownOverCardId] = useState<string | null>(null)
  if (overCard && overCard.id !== shownOverCardId) setShownOverCardId(overCard.id)
  const shownSheetCard = shownSheetCardId ? paymentMethods.find((m) => m.id === shownSheetCardId) : undefined
  const shownOverCard = shownOverCardId ? paymentMethods.find((m) => m.id === shownOverCardId) : undefined
  const close = () => { setSheet(null); setOver(null); clearAccountPrefill(); setFoundOpen(false) }
  const foundSheetOpen = sheet?.kind === 'found' || foundOpen
  const addOpen = sheet?.kind === 'add' || accountPrefill !== null
  const addKey = accountPrefill ? `p-${accountPrefill.last4}` : sheet?.kind === 'add' ? 'a' : 'x'

  // Hardware back and the iOS edge swipe step out of the provider page before leaving Accounts. Keyed on "open" only,
  // so the guard is never re-registered above a sheet opened from the provider page.
  useEffect(() => {
    if (!providerOpen) return
    return registerBackGuard(() => { setProviderKey(null); return true })
  }, [providerOpen])

  // A provider whose last account was closed is gone: forget it, so adding that bank again does not reopen its page.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears a key that no longer names a group
    if (providerKey && !providerOpen) setProviderKey(null)
  }, [providerKey, providerOpen])

  const openProvider = (key: string) => { setProviderKey(key); window.scrollTo({ top: 0 }) }
  const openAccount = (a: AccountView) => { setOver(null); setSheet({ kind: 'detail', id: a.method.id }) }
  const openCard = (card: PaymentMethod) => setSheet({ kind: 'cardSheet', cardId: card.id })
  const openFace = (face: ProviderFace) => {
    const account = face.isAccount ? model.accounts.find((a) => a.method.id === face.method.id) : undefined
    if (account) openAccount(account)
    else openCard(face.method)
  }
  const details = (m: PaymentMethod) => cardDetails(m, debts, expenses, debtPayments, exchangeRates)
  const baseEquivalent = (a: AccountView): string | undefined => {
    const cur = String(a.method.currency)
    if (!a.balance || cur === base) return undefined
    const v = tryConvertCurrency(a.balance.balance, cur, base, exchangeRates)
    return v === null || noRate(cur) ? t.noRateToday : `≈ ${splitMoney(v, base).int} ${base}`
  }

  const renderRow = (a: AccountView) => (
    <AccountRow key={a.method.id} account={a} shared={sharesProvider(a.method, model.accounts.map((x) => x.method))} masked={listMasked} gap={gaps[a.method.id]?.amount}
      baseEquivalent={baseEquivalent(a)}
      onOpen={() => openAccount(a)}
      onFix={() => setSheet({ kind: 'fix', id: a.method.id })}
      onAddCard={() => setSheet({ kind: 'card', id: a.method.id })} />
  )
  const renderProviderCard = (g: ProviderGroup) => (
    <ProviderCard key={g.key} group={approxGroup(g)} base={base} masked={listMasked} alert={g.accounts.some((a) => (gaps[a.method.id]?.amount ?? 0) !== 0)}
      onOpen={() => openProvider(g.key)} onFace={openFace} />
  )
  const parentOf = (m: PaymentMethod) => (m.parentId ? model.accounts.find((a) => a.method.id === m.parentId)?.method : undefined)
  const cardList = (cards: PaymentMethod[]) => (
    <Card padding="none" divide className="overflow-hidden rounded-2xl">
      {cards.map((c) => <CardRow key={c.id} method={c} parent={parentOf(c)} details={details(c)} masked={listMasked} onOpen={() => openCard(c)} />)}
    </Card>
  )

  // Every user has a Cash; until it has a balance it waits here, on the empty page too (docs/SYSTEM_CASH_PLAN.md).
  // Untracked Cash can still be the default payment (BUD-87): its menu sits beside the row's tap target, not inside it.
  const cashRow = model.needsCash ? (
          <div className="flex min-h-[72px] w-full items-center gap-1 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] pe-2">
            <button type="button" onClick={() => setSheet({ kind: 'detail', id: cashMethod?.id ?? ensureCashAccount() })} data-raw-button-ok="a whole-row tap target, sized by its content"
              className="flex min-h-[72px] min-w-0 flex-1 items-center gap-3.5 ps-4 text-start">
              <BrandMark name="Cash" color="var(--color-brand-sunken)" icon={createElement(paymentTypeIcon('cash'), { className: 'size-5', 'aria-hidden': true })} />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-[var(--color-brand-text-primary)]">{t.typeCash}</span>
                <span className="block text-[0.8125rem] text-[var(--color-brand-text-muted)]">{t.addBalanceToInclude}</span>
              </span>
              <span className="text-sm font-semibold text-[var(--color-brand-primary-ink)]">{t.setBalance}</span>
            </button>
            {cashIsDefault ? null : (
              <IconButton aria-label={all.common.moreActions} aria-haspopup="menu" aria-expanded={cashMenu !== null} onClick={(e) => setCashMenu(e.currentTarget.getBoundingClientRect())}>
                <MoreVertical size={18} />
              </IconButton>
            )}
            <CardActionMenu anchor={cashMenu} onClose={() => setCashMenu(null)}
              items={[{ label: all.paymentMethods.setDefault, icon: <Star size={17} />, onSelect: () => updatePaymentMethod(ensureCashAccount(), { isDefault: true }) }]} />
          </div>
  ) : null

  // Cards alone (a credit card, pay-later, a store card) still make a page: their groups and Other cards are where they live.
  const nothingYet = model.accounts.length === 0 && groups.banks.length === 0 && groups.wallets.length === 0 && groups.otherCards.length === 0
  const empty = nothingYet ? (
      <PageContainer>
        <EmptyState className="min-h-[60vh]" title={t.emptyTitle} description={t.emptySub}
          action={<div className="flex w-full max-w-xs flex-col gap-2">
            <Button size="cta-block" onClick={() => setSheet({ kind: 'found' })} className="font-semibold">{t.findMyAccounts}</Button>
            <Button variant="outline" size="cta-block" onClick={() => setSheet({ kind: 'add' })}>{t.addOneMyself}</Button>
          </div>} />
        {cashRow}
      </PageContainer>
  ) : null

  const walletCount = groups.wallets.length + groups.cash.length
  const home = (
    <>
      <AccountsHero model={missingRates.length > 0 && !model.approx ? { ...model, approx: true } : model} currency={base} netWorth={nw.netWorth} creditOwed={owed} hidden={heroMasked} onToggleHidden={toggle} />
      <PageContainer className="space-y-5 py-4">
        {rateDismissed ? null : <RateAlert currencies={missingRates} onDismiss={() => setRateDismissed(true)} />}
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
        {groups.banks.length > 0 ? (
          <section>
            <SectionHeader title={t.banks} count={groups.banks.length} onAdd={() => setSheet({ kind: 'add' })} addLabel={t.addAccount} />
            <div className="flex flex-col gap-2.5">{groups.banks.map(renderProviderCard)}</div>
          </section>
        ) : null}
        {walletCount > 0 || cashRow ? (
          <section>
            <SectionHeader title={t.walletsCash} count={walletCount}
              onAdd={groups.banks.length > 0 ? undefined : () => setSheet({ kind: 'add' })} addLabel={t.addAccount} />
            <div className="flex flex-col gap-2.5">
              {groups.wallets.map(renderProviderCard)}
              {groups.cash.length > 0 ? <Card padding="none" className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl">{groups.cash.map(renderRow)}</Card> : null}
              {cashRow}
            </div>
          </section>
        ) : null}
        {groups.otherCards.length > 0 ? (
          <section>
            <SectionHeader title={t.standaloneCards} count={groups.otherCards.length} onAdd={() => setSheet({ kind: 'addCard' })} addLabel={t.addCardCta} />
            {cardList(groups.otherCards.map((f) => f.method))}
          </section>
        ) : null}
      </PageContainer>
    </>
  )

  /** A bank or wallet on its own: the tinted hero, its accounts with their cards, its credit cards, closed accounts. */
  const providerView = (group: ProviderGroup) => {
    const credit = group.cards.filter((f) => f.method.type === 'credit_card').map((f) => f.method)
    const orphans = group.cards.filter((f) => !f.parentAccountId && !f.isAccount && f.method.type !== 'credit_card').map((f) => f.method)
    const closed = paymentMethods.filter((m) => m.closedAt && !m.parentId && holdsBalance(m.type) && providerKeyOf(m) === group.key).length
    // A prepaid card holds its own balance but is a card, as the hero's "N accounts · M cards" counts it.
    const held = group.accounts.filter((a) => a.method.type !== 'prepaid_card')
    const prepaid = group.accounts.filter((a) => a.method.type === 'prepaid_card')
    return (
      <>
        <ProviderHero group={approxGroup(group)} base={base} hidden={heroMasked} onToggleHidden={toggle} onBack={() => setProviderKey(null)} />
        <PageContainer className="space-y-5 py-4">
          <section>
            <SectionHeader title={t.title} count={group.accountCount} onAdd={() => setSheet({ kind: 'add' })} addLabel={t.addAccount} />
            {held.length > 0 ? <Card padding="none" className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl">{held.map(renderRow)}</Card> : null}
          </section>
          {credit.length > 0 ? (
            <section>
              <SectionHeader title={t.creditCards} count={credit.length} />
              {cardList(credit)}
              <p className="mt-2 px-1 text-xs leading-[1.45] text-[var(--color-brand-text-muted)] [text-wrap:pretty]">{t.creditNote}</p>
            </section>
          ) : null}
          {orphans.length + prepaid.length > 0 ? (
            <section className="space-y-2.5">
              <SectionHeader title={t.cardsHeading} count={orphans.length + prepaid.length} />
              {prepaid.length > 0 ? <Card padding="none" className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl">{prepaid.map(renderRow)}</Card> : null}
              {orphans.length > 0 ? cardList(orphans) : null}
            </section>
          ) : null}
          {closed > 0 ? (
            <p className="flex min-h-12 items-center gap-2.5 rounded-[14px] border border-dashed border-[var(--color-brand-border-strong)] px-4 text-[0.8125rem] font-semibold text-[var(--color-brand-text-secondary)]">
              <Archive aria-hidden className="size-4 shrink-0" />{t.closedAccounts(closed)}
            </p>
          ) : null}
        </PageContainer>
      </>
    )
  }

  const balanceSaved = (id: string) => { const g = gaps[id]; if (g) { snoozeGap(id, g.reportedAt); refresh() } }
  return (
    <div>
      {empty ?? (provider ? providerView(provider) : home)}

      {open ? (
        <>
          <AccountDetailSheet key={`d-${open.method.id}`} open={sheet?.kind === 'detail'} onClose={close} account={open} masked={listMasked}
            behind={over !== null} gap={gaps[open.method.id]?.amount} onFix={() => setSheet({ kind: 'fix', id: open.method.id })}
            onBalanceSaved={() => balanceSaved(open.method.id)}
            onMove={(mode) => setSheet({ kind: 'move', id: open.method.id, mode })}
            onAddCard={() => setOver({ kind: 'addCard' })} onEdit={() => setSheet({ kind: open.method.type === 'cash' ? 'cashCurrency' : 'edit', id: open.method.id })}
            onOpenCard={(c) => setOver({ kind: 'card', cardId: c.id })} />
          <MoveMoneySheet key={`m-${open.method.id}-${sheet?.kind === 'move' ? sheet.mode : ''}`} open={sheet?.kind === 'move'} onClose={close}
            accounts={model.accounts} initialAccountId={open.method.id} initialMode={sheet?.kind === 'move' ? sheet.mode : 'cash'} initialAmount={sheet?.kind === 'move' ? sheet.amount : undefined}
            onDone={() => { const g = gaps[open.method.id]; if (g && sheet?.kind === 'move' && sheet.fromGap) { snoozeGap(open.method.id, g.reportedAt); refresh() } }} />
          {open.method.type === 'cash' ? (
            <CashCurrencySheet key={`c-${open.method.id}-${sheet?.kind === 'cashCurrency'}`} open={sheet?.kind === 'cashCurrency'} onClose={close} account={open} />
          ) : null}
          {gaps[open.method.id] ? (
            <FixGapSheet key={`f-${open.method.id}`} open={sheet?.kind === 'fix'} onClose={close} account={open} gap={gaps[open.method.id]}
              onSetAside={(amount) => setSheet({ kind: 'move', id: open.method.id, mode: 'set', amount: String(amount), fromGap: true })} onResolved={refresh} />
          ) : null}
          <PaymentMethodSetupSheet open={sheet?.kind === 'card'} editing={null} baseCurrency={settings.baseCurrency} parentAccountId={open.method.id} extraChoices={['virtual']} excludeTypes={['wallet']} nested onClose={close} />
          <PaymentMethodSetupSheet open={sheet?.kind === 'detail' && over?.kind === 'addCard'} editing={null} baseCurrency={settings.baseCurrency} parentAccountId={open.method.id}
            titleOverride={t.addCardTo(accountTitle(open.method))} extraChoices={['virtual']} excludeTypes={['wallet']} nested onClose={() => setOver(null)} />
          <PaymentMethodSetupSheet key={`e-${open.method.id}`} open={sheet?.kind === 'edit'} editing={open.method} baseCurrency={settings.baseCurrency} nested onClose={close} />
          {shownOverCard ? (
            <CardDetailSheet key={`oc-${shownOverCard.id}`} open={sheet?.kind === 'detail' && over?.kind === 'card' && !!overCard} card={shownOverCard} parent={open.method} masked={listMasked} zIndexClassName="z-[110]"
              onClose={() => setOver(null)} onLeave={close} onEdit={() => setOver({ kind: 'editCard', cardId: shownOverCard.id })} />
          ) : null}
        </>
      ) : null}
      {shownSheetCard ? (
        <CardDetailSheet key={`cs-${shownSheetCard.id}`} open={!!sheetCard} card={shownSheetCard} parent={parentOf(shownSheetCard)} masked={listMasked} behind={over !== null} onClose={close}
          onEdit={() => setOver({ kind: 'editCard', cardId: shownSheetCard.id })}
          onOpenParent={shownSheetCard.parentId && viewOf(shownSheetCard.parentId) ? () => { setOver(null); setSheet({ kind: 'detail', id: shownSheetCard.parentId as string }) } : undefined} />
      ) : null}
      {shownOverCard ? (
        <PaymentMethodSetupSheet key={`ec-${shownOverCard.id}`} open={over?.kind === 'editCard' && !!overCard} editing={shownOverCard} baseCurrency={settings.baseCurrency} nested onClose={() => setOver(null)} />
      ) : null}
      <PaymentMethodSetupSheet open={sheet?.kind === 'addCard'} editing={null} baseCurrency={settings.baseCurrency} extraChoices={['store']} excludeTypes={['wallet']} nested onClose={close} />
      <AddAccountSheet key={addKey} open={addOpen} prefill={accountPrefill ?? undefined} onClose={close} pushCardStep onOnlyCard={() => { clearAccountPrefill(); setSheet({ kind: 'addCard' }) }} />
      <DetectedAccountsSheet open={foundSheetOpen} onClose={close} onManual={() => setSheet({ kind: 'add' })} />
      <UnplacedSmsSheet key={unplaced.length} open={sheet?.kind === 'unplaced'} onClose={close} items={unplaced} accounts={model.accounts} />
    </div>
  )
}
