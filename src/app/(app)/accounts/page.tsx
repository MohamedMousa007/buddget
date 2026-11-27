'use client'

import { useEffect, useMemo, useState } from 'react'
import { Archive, Landmark, MoreVertical, Plus, Star, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { IconButton } from '@/components/ui/IconButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageGrid } from '@/components/layout/PageGrid'
import { PageHero } from '@/components/layout/PageHero'
import { AccountsHero } from '@/components/features/accounts/AccountsHero'
import { AccountRow } from '@/components/features/accounts/AccountRow'
import { CardRow } from '@/components/features/accounts/CardRow'
import { ProviderCard } from '@/components/features/accounts/ProviderCard'
import { ProviderHero } from '@/components/features/accounts/ProviderHero'
import { RateAlert } from '@/components/features/accounts/RateAlert'
import { accountDisplayName, accountTitle, moneyFlex, sharesProvider, splitMoney } from '@/components/features/accounts/accountDisplay'
import { AccountDetailSheet } from '@/components/features/accounts/AccountDetailSheet'
import { AddAccountSheet } from '@/components/features/accounts/AddAccountSheet'
import { CashCurrencySheet } from '@/components/features/accounts/CashCurrencySheet'
import { FixGapSheet } from '@/components/features/accounts/FixGapSheet'
import { DetectedAccountsSheet } from '@/components/features/accounts/DetectedAccountsSheet'
import { PendingRow } from '@/components/ui/PendingRow'
import { PromptBanner } from '@/components/ui/PromptBanner'
import { CloseAccountMoneySheet, ShortfallSheet } from '@/components/features/accounts/SetAsideAnswerSheet'
import { shortfallEpisodes } from '@/lib/savings/shortfall'
import { settlePrompt } from '@/lib/prompts/settle'
import { useDetectedAccounts } from '@/hooks/useDetectedAccounts'
import { CashOnHandMark, MoveMoneySheet, type MoveMode } from '@/components/features/accounts/MoveMoneySheet'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { UnplacedSmsSheet } from '@/components/features/accounts/UnplacedSmsSheet'
import { CardDetailSheet } from '@/components/features/accounts/CardDetailSheet'
import { SetAsideListSheet } from '@/components/features/accounts/SetAsideListSheet'
import { PaymentMethodSetupSheet } from '@/components/features/payments/PaymentMethodSetupSheet'
import { ensureCashAccount } from '@/lib/accounts/actions'
import { cardDetails } from '@/lib/accounts/cardDetails'
import { holdsBalance } from '@/lib/accounts/kinds'
import { groupByProvider, providerKeyOf, type ProviderFace, type ProviderGroup } from '@/lib/accounts/providerGroups'
import { snoozeGap, useAccountGaps } from '@/lib/accounts/useAccountGaps'
import { useAccounts, useLedgerInput, type AccountView } from '@/lib/accounts/useAccounts'
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
import type { PmPrefill } from '@/lib/store/useSettingsStore'
import { totalDebtRemainingInBase } from '@/lib/utils/calculations'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { useT } from '@/lib/i18n'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'

/** A sheet stacked over the account or card sheet, which scales back behind it. */
type Over = { kind: 'addCard' } | { kind: 'card'; cardId: string } | { kind: 'editCard'; cardId: string }

const NOT_FX = new Set(['XAU', 'BTC', 'ETH'])
/** A card under an account: Debit | Credit | Prepaid only (pay-later lives in Debts, wallets are accounts). */
const CARD_ONLY: PaymentMethod['type'][] = ['wallet', 'bnpl', 'other']

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
  | { kind: 'addCard'; prefill?: PmPrefill }
  | { kind: 'add' }
  | { kind: 'found' }
  | { kind: 'unplaced' }
  /** "CIB is short X" (LOGIC_SPEC §4.2). */
  | { kind: 'short'; id: string }
  /** "Where did this money go?" before closing an account that holds set-aside money (§4.8). */
  | { kind: 'closeHeld'; id: string }
  /** The hero's "X set aside": pockets and goals kept in accounts. */
  | { kind: 'setAside' }

/** The Wealth and Debts header row: title, count, and the page's add action at the end. */
function SectionHeader({ title, count, onAdd, addLabel }: { title: string; count: number; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="mb-2 flex min-h-11 items-center gap-2 px-1">
      <h2 className="text-[17px] font-bold text-[var(--color-brand-text-primary)]">{title}</h2>
      <span className="font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-text-muted)]">{count}</span>
      {onAdd ? (
        <Button variant="ghost" size="touch" className="ms-auto gap-1 px-1 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)] hover:text-[var(--color-brand-primary-ink)] [&_svg:not([class*='size-'])]:size-4" onClick={onAdd}>
          <Plus aria-hidden />{addLabel}
        </Button>
      ) : null}
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
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const ltCash = useAccountsLtCopy().cash
  const ltShort = useAccountsLtCopy().short
  const ltV9 = useAccountsLtCopy().v9
  const ledger = useLedgerInput()
  // One notice per account per shortfall episode, until it is covered (auto-clears) or kept for now (settled).
  const episodes = useMemo(() => shortfallEpisodes(ledger), [ledger])
  const asking = useMemo(() => episodes.filter((e) => !settings.promptState?.[e.key]), [episodes, settings.promptState])
  const base = String(settings.baseCurrency)

  const owed = useMemo(
    () => totalDebtRemainingInBase(debts.filter((d) => d.debtType === 'credit_card'), debtPayments, settings.baseCurrency, exchangeRates, goldPricePerGram, goldPriceAvailable, expenses, debts),
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

  const heroSegments = useMemo(() => [
    ...[...groups.banks, ...groups.wallets].map((g) => ({ key: g.key, label: g.name, value: g.totalInBase })),
    ...groups.cash.filter((a) => a.balance).map((a) => ({
      key: a.method.id, label: accountTitle(a.method),
      value: tryConvertCurrency(a.balance!.balance, String(a.method.currency), base, exchangeRates) ?? 0,
    })),
  ], [groups, base, exchangeRates])

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
      onShort={asking.some((e) => e.accountId === a.method.id) ? () => setSheet({ kind: 'short', id: a.method.id }) : undefined}
      onAddCard={() => setSheet({ kind: 'card', id: a.method.id })} onOpenCard={openCard} />
  )
  const renderProviderCard = (g: ProviderGroup) => (
    <ProviderCard key={g.key} group={approxGroup(g)} base={base} masked={listMasked} alert={g.accounts.some((a) => (gaps[a.method.id]?.amount ?? 0) !== 0)}
      onOpen={() => openProvider(g.key)} onFace={openFace} onAddCard={() => addCardAt(g)} />
  )
  // The dashed + slot on a provider card: the card form starts at that bank, under its only account when it has one.
  const addCardAt = (g: ProviderGroup) => {
    const held = g.accounts.filter((a) => a.method.type !== 'prepaid_card')
    setSheet({ kind: 'addCard', prefill: { name: g.name, last4: '', ...(held.length === 1 ? { parentId: held[0].method.id } : {}) } })
  }
  const parentOf = (m: PaymentMethod) => (m.parentId ? model.accounts.find((a) => a.method.id === m.parentId)?.method : undefined)
  const cardList = (cards: PaymentMethod[]) => (
    <Card padding="none" divide className="overflow-hidden rounded-2xl">
      {cards.map((c) => <CardRow key={c.id} method={c} parent={parentOf(c)} details={details(c)} masked={listMasked} onOpen={() => openCard(c)} />)}
    </Card>
  )

  // Every user has a Cash; until it has a balance it waits here, on the empty page too (docs/SYSTEM_CASH_PLAN.md).
  // Untracked Cash can still be the default payment (BUD-87): its menu sits beside the row's tap target, not inside it.
  // Light touch: a dimmed "Cash on hand · Not tracked" row whose Start tracking asks how much cash there is.
  const cashRow = model.needsCash ? (
          <div className={`flex min-h-[72px] w-full items-center rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] py-3 ps-4 ${cashIsDefault ? 'gap-3.5 pe-4' : 'gap-3 pe-0'}`}>
            <span className="opacity-50"><CashOnHandMark size={44} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold tracking-[-0.01em] text-[var(--color-brand-text-secondary)]">{ltCash.title}</span>
              <span className="mt-0.5 block truncate text-[0.8125rem] text-[var(--color-brand-text-muted)]">{ltCash.notTracked}</span>
            </span>
            {/* The mockup's quiet 36px option pill; its ::after keeps the 44px touch target. */}
            <Button variant="outline" className="relative h-9 shrink-0 rounded-full px-3 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)] after:absolute after:left-1/2 after:top-1/2 after:min-h-11 after:min-w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']" onClick={() => setActiveModal('askCashOnHand')}>{ltCash.startTracking}</Button>
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
  const firstShort = episodes[0]
  const shortMethod = firstShort ? viewOf(firstShort.accountId)?.method : undefined
  const heroShort = firstShort && shortMethod
    ? { text: ltShort.title(accountDisplayName(shortMethod), moneyFlex(firstShort.short, firstShort.currency)), onPress: () => setSheet({ kind: 'short', id: firstShort.accountId }) }
    : undefined
  const home = (
    <>
      <PageHero inset>
        <AccountsHero model={missingRates.length > 0 && !model.approx ? { ...model, approx: true } : model} currency={base} netWorth={nw.netWorth} creditOwed={owed}
          segments={heroSegments} hidden={heroMasked} onToggleHidden={toggle} onSetAside={() => setSheet({ kind: 'setAside' })}
          short={heroShort} />
      </PageHero>
      <PageGrid stack primary={<div className="space-y-5 px-4 py-4 lg:px-0 lg:pt-0">
        {rateDismissed ? null : <RateAlert currencies={missingRates} onDismiss={() => setRateDismissed(true)} />}
        {asking.map((e) => {
          const m = viewOf(e.accountId)?.method
          return m ? (
            <PromptBanner key={e.key} tone="warning" icon={<TriangleAlert aria-hidden />} title={ltShort.title(accountDisplayName(m), moneyFlex(e.short, e.currency))}
              description={ltShort.bannerBody} confirmLabel={ltShort.bannerCta} onConfirm={() => setSheet({ kind: 'short', id: e.accountId })}
              dismissLabel={ltShort.keep} onDismiss={() => settlePrompt(e.key)} />
          ) : null
        })}
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
            <SectionHeader title={t.standaloneCards} count={groups.otherCards.length} />
            {cardList(groups.otherCards.map((f) => f.method))}
          </section>
        ) : null}
      </div>} />
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
        <PageHero inset className="pt-2">
          <ProviderHero group={approxGroup(group)} base={base} hidden={heroMasked} onToggleHidden={toggle} onBack={() => setProviderKey(null)} />
        </PageHero>
        <PageGrid stack primary={<div className="space-y-5 px-4 py-4 lg:px-0 lg:pt-0">
          <section>
            <SectionHeader title={t.title} count={group.accountCount} onAdd={() => setSheet({ kind: 'add' })} addLabel={t.addAccount} />
            {held.length > 0 ? <Card padding="none" className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl">{held.map(renderRow)}</Card> : null}
          </section>
          {credit.length > 0 ? (
            <section>
              <SectionHeader title={t.creditCards} count={credit.length} />
              {cardList(credit)}
              <p className="mt-2 px-1 text-xs leading-[1.45] text-[var(--color-brand-text-muted)] [text-wrap:pretty]">{ltV9.creditTip}</p>
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
        </div>} />
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
            onAddCard={() => setOver({ kind: 'addCard' })}
            onSeeAllCards={() => { const key = providerKeyOf(open.method); close(); openProvider(key) }}
            onEdit={() => setSheet({ kind: open.method.type === 'cash' ? 'cashCurrency' : 'edit', id: open.method.id })}
            onOpenCard={(c) => setOver({ kind: 'card', cardId: c.id })}
            onCloseHeld={() => setSheet({ kind: 'closeHeld', id: open.method.id })}
            onShort={() => setSheet({ kind: 'short', id: open.method.id })} />
          {sheet?.kind === 'short' ? <ShortfallSheet key={`s-${open.method.id}`} account={open.method} onClose={close} /> : null}
          {sheet?.kind === 'closeHeld' ? <CloseAccountMoneySheet key={`h-${open.method.id}`} account={open.method} onClose={close} onClosed={close} /> : null}
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
          <PaymentMethodSetupSheet open={sheet?.kind === 'card'} editing={null} baseCurrency={settings.baseCurrency} parentAccountId={open.method.id} excludeTypes={CARD_ONLY} nested onClose={close} />
          <PaymentMethodSetupSheet open={sheet?.kind === 'detail' && over?.kind === 'addCard'} editing={null} baseCurrency={settings.baseCurrency} parentAccountId={open.method.id}
            excludeTypes={CARD_ONLY} nested onClose={() => setOver(null)} />
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
      <PaymentMethodSetupSheet open={sheet?.kind === 'addCard'} prefill={sheet?.kind === 'addCard' ? sheet.prefill ?? null : null} editing={null} baseCurrency={settings.baseCurrency} extraChoices={['store']} excludeTypes={['wallet']} nested onClose={close} />
      <AddAccountSheet key={addKey} open={addOpen} prefill={accountPrefill ?? undefined} onClose={close} pushCardStep onOnlyCard={() => { clearAccountPrefill(); setSheet({ kind: 'addCard' }) }} />
      <SetAsideListSheet open={sheet?.kind === 'setAside'} onClose={close} onShort={(id) => setSheet({ kind: 'short', id })} />
      <DetectedAccountsSheet open={foundSheetOpen} onClose={close} onManual={() => setSheet({ kind: 'add' })} />
      <UnplacedSmsSheet key={unplaced.length} open={sheet?.kind === 'unplaced'} onClose={close} items={unplaced} accounts={model.accounts} />
    </div>
  )
}
