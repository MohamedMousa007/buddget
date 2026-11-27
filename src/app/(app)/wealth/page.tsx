'use client'

import { countedDebtPayments, countedDebts } from '@/lib/spending/exclusion'
import { selectActivePlan } from '@/lib/budget/activePlan'
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ArrowDownLeft, ArrowUpRight, Pencil, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { StatusPill } from '@/components/ui/StatusPill'
import { useAlert, useConfirm } from '@/components/ui/dialog/DialogProvider'
import { useActionToast } from '@/components/ui/ActionToast'
import { deleteHoldingWithUndo, deletePocketWithUndo } from '@/lib/savings/pocketUndo'
import { PageGrid } from '@/components/layout/PageGrid'
import { PageHero } from '@/components/layout/PageHero'
import { FlowStickyStrip } from '@/components/features/flow/FlowStickyStrip'
import { AddHoldingSheet } from '@/components/features/savings-v3/AddHoldingSheet'
import { AddSavingsSheetV3 } from '@/components/features/savings-v3/AddSavingsSheetV3'
import { EmergencyFundSheet } from '@/components/features/savings-v3/EmergencyFundSheet'
import { MonthEndSheet } from '@/components/features/savings-v3/MonthEndSheet'
import { MonthlySavingRow, type MonthlySavingRowProps } from '@/components/features/savings-v3/MonthlySavingRow'
import { useMonthEnd } from '@/hooks/useMonthEnd'
import { useMonthEndCopy } from '@/lib/i18n/monthEndCopy'
import { monthNames } from '@/lib/i18n/dateFormat'
import { SavingsHero, type HeroSplitSegment } from '@/components/features/savings-v3/SavingsHero'
import { WealthPlanRows } from '@/components/features/savings-v3/WealthPlanRows'
import { WealthList } from '@/components/features/savings-v3/WealthList'
import { GoalsSection, PocketsSection, SavingsAccountsSection, type PocketItem } from '@/components/features/savings-v3/SavingsSections'
import { PocketSheet } from '@/components/features/savings-v3/PocketSheet'
import { ReleaseSheet } from '@/components/features/savings-v3/ReleaseSheet'
import { useGoalRows } from '@/hooks/useGoalRows'
import { useAccounts } from '@/lib/accounts/useAccounts'
import { partitionGoals } from '@/lib/goals/partitionGoals'
import { partsOfGoal } from '@/lib/goals/computeGoalProgress'
import { isMonthlySavingsPart } from '@/lib/savings/canDeletePocket'
import { useSavingsV9Copy } from '@/lib/i18n/savingsV9Copy'
import { navigate } from '@/lib/navigation/navigate'
import { cashSavingsDepositsInBaseForMonth } from '@/lib/utils/calculations'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { WithdrawSheetV3 } from '@/components/features/savings-v3/WithdrawSheetV3'
import { ZakatBasisPrompt } from '@/components/features/savings-v3/ZakatBasisPrompt'
import { ZakatSheet } from '@/components/features/savings-v3/ZakatSheet'
import type { PocketVM } from '@/components/features/savings-v3/types'
import { EditSavingsAccountSheet } from '@/components/modals/EditSavingsAccountSheet'
import { useAssetPrices } from '@/hooks/useAssetPrices'
import { useEnsureMonthlySavingsVault } from '@/hooks/useEnsureMonthlySavingsVault'
import { useHiddenStatus } from '@/hooks/useHiddenStatus'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useNetWorth } from '@/hooks/useNetWorth'
import { netWorthBasisOf } from '@/lib/savings/netWorth'
import { useNetWorthTrend } from '@/hooks/useNetWorthTrend'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { canDeletePocket } from '@/lib/savings/canDeletePocket'
import { pocketDeleteEffect } from '@/lib/savings/pocketDeleteEffect'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
import { useLocale, useT } from '@/lib/i18n'
import { useWealthLtCopy } from '@/lib/i18n/wealthLtCopy'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { localTodayISO } from '@/lib/utils/localDate'
import { computeEmergencyFund } from '@/lib/savings/emergencyFund'
import { parseDateOnly } from '@/lib/time/calendarDays'
import { deriveHawl } from '@/lib/savings/hawl'
import { deriveSimpleMonth } from '@/lib/savings/simpleMonth'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import { buildWealth, emergencyState, type WealthRowVM } from '@/lib/savings/wealthModel'
import { computeZakat } from '@/lib/savings/zakat'
import { toZakatInput } from '@/lib/savings/zakatInputs'
import { evaluateZakatYear, zakatBaseAt, type ZakatSources } from '@/lib/savings/zakatYear'
import { useLedgerInput } from '@/lib/accounts/useAccounts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { InvestmentAssetType, SavingsAccount } from '@/lib/store/types'
import { formatWhole } from '@/lib/utils/formatters'

/** Past this scroll the band's detail has left the viewport: collapse into the sticky strip. */
const COLLAPSE_AT = 150

export default function WealthPage() {
  useEnsureMonthlySavingsVault()
  const t = useT().wealthPage
  const { locale } = useLocale()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const requireAuth = useRequireAuthAction()
  const confirmDialog = useConfirm()
  const showToast = useActionToast()
  const alertDialog = useAlert()
  const nw = useNetWorth()
  const stats = useMonthlyStats()
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const { lookup, refresh: refreshPrices } = useAssetPrices()
  const wl = useWealthLtCopy()
  const {
    savingsAccounts, savingsTransactions, investmentHoldings, goals, profile, settings, exchangeRates,
    budgetPlans, activeBudgetPlanId, debts, goldPricePerGram, goldPriceAvailable, debtPayments, paymentMethods,
  } = useFinanceStore(
    useShallow((s) => ({
      savingsAccounts: s.savingsAccounts,
      savingsTransactions: s.savingsTransactions,
      investmentHoldings: s.investmentHoldings,
      goals: s.goals,
      profile: s.profile,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      budgetPlans: s.budgetPlans,
      activeBudgetPlanId: s.activeBudgetPlanId,
      debts: countedDebts(s.debts, s.paymentMethods),
      goldPricePerGram: s.goldPricePerGram,
      goldPriceAvailable: s.goldPriceAvailable,
      debtPayments: countedDebtPayments(s.debtPayments, s.debts, s.paymentMethods),
      paymentMethods: s.paymentMethods,
    })),
  )
  const base = settings.baseCurrency
  const goldOk = goldPriceAvailable !== false

  const [addOpen, setAddOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [holdingOpen, setHoldingOpen] = useState<{ preset: InvestmentAssetType | null; investment?: boolean } | null>(null)
  const [editAcc, setEditAcc] = useState<SavingsAccount | null>(null)
  const [prefillId, setPrefillId] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ row: WealthRowVM; anchor: DOMRect } | null>(null)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [zakatOpen, setZakatOpen] = useState(false)
  const [monthEndOpen, setMonthEndOpen] = useState(false)
  /** Opened from the Monthly savings pocket's split row: the split is in view even when a leftover waits. */
  const [monthEndSplit, setMonthEndSplit] = useState(false)
  const [pocketOpen, setPocketOpen] = useState<string | null>(null)
  const [releaseOf, setReleaseOf] = useState<SavingsAccount | null>(null)
  const v9 = useSavingsV9Copy().page
  const goalRows = useGoalRows()
  const accountsModel = useAccounts()
  const monthEnd = useMonthEnd()
  const mc = useMonthEndCopy()
  // Quick add > Savings lands here asking for the add-money sheet (auth was checked at the tile). The request stays in
  // the store until the sheet closes; it is never cleared in an unmount cleanup, which StrictMode runs on mount (Q3).
  const wealthAddRequested = useSettingsStore((s) => s.wealthAddRequested)
  const showAdd = addOpen || wealthAddRequested
  const [collapsed, setCollapsed] = useState(false)
  const [feedHidden, hideFeed] = useHiddenStatus('gold-prices')

  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > COLLAPSE_AT)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const model = useMemo(
    () => buildWealth({ accounts: savingsAccounts, holdings: investmentHoldings, lookup, baseCurrency: base, rates: exchangeRates, goldPricePerGram, goldOk }),
    [savingsAccounts, investmentHoldings, lookup, base, exchangeRates, goldPricePerGram, goldOk],
  )
  const pockets = useMemo(() => savingsAccounts.filter((a) => a.category === 'savings'), [savingsAccounts])

  // Emergency fund: cover = all savings pockets (the sheet never writes a per-pocket list).
  const coverPocketIds = useMemo(() => profile.emergencyFundConfig?.coverPocketIds ?? pockets.map((a) => a.id), [profile.emergencyFundConfig, pockets])
  const coverAmount = useMemo(
    () => pockets.filter((a) => coverPocketIds.includes(a.id)).reduce((s, a) => s + (savingsAccountBalanceInBase(a, base, exchangeRates, goldPricePerGram, goldOk) ?? 0), 0),
    [pockets, coverPocketIds, base, exchangeRates, goldPricePerGram, goldOk],
  )
  const simpleMonth = useMemo(
    () => deriveSimpleMonth({ profile, activePlan: selectActivePlan(budgetPlans, activeBudgetPlanId) ?? undefined, debts, baseCurrency: base, exchangeRates, override: profile.emergencyFundConfig?.monthlyEssentials }),
    [profile, budgetPlans, activeBudgetPlanId, debts, base, exchangeRates],
  )
  const targetMonths = profile.emergencyFundConfig?.targetMonths ?? 3
  const emergency = useMemo(() => computeEmergencyFund({ coverAmount, monthlyEssentials: simpleMonth.total, targetMonths }), [coverAmount, simpleMonth.total, targetMonths])
  const efState = emergencyState(simpleMonth.total, emergency.atOrAboveTarget)

  // Zakat: gold until the user picks a basis (see zakatBasis.ts).
  const ledger = useLedgerInput()
  const zakatSources = useMemo<ZakatSources>(
    () => ({ ledger, investmentHoldings, debts, debtPayments, baseCurrency: base, exchangeRates, goldPricePerGram, goldPriceAvailable: goldOk, lookup }),
    [ledger, investmentHoldings, debts, debtPayments, base, exchangeRates, goldPricePerGram, goldOk, lookup],
  )
  const zakatBase = useMemo(() => zakatBaseAt(zakatSources, profile.zakatConfig), [zakatSources, profile.zakatConfig])
  const zakatResult = useMemo(() => computeZakat(toZakatInput(zakatBase, profile.zakatConfig)), [zakatBase, profile.zakatConfig])
  const hawl = useMemo(
    () => deriveHawl({ yearStartDate: profile.zakatConfig?.yearStartDate, lastPaidDate: profile.zakatConfig?.lastPaidDate, createdAt: profile.createdAt }),
    [profile.zakatConfig?.yearStartDate, profile.zakatConfig?.lastPaidDate, profile.createdAt],
  )
  const today = localTodayISO()
  const zakatYear = useMemo(
    () => evaluateZakatYear(zakatSources, profile.zakatConfig, hawl.dueDate, today),
    [zakatSources, profile.zakatConfig, hawl.dueDate, today],
  )
  const hawlDate = useMemo(() => formatLocalized(parseDateOnly(hawl.dueDate), 'd MMM yyyy', locale), [hawl.dueDate, locale])
  const silverNisab = 595 * zakatBase.silverPerGram
  const goldNisab = 85 * zakatBase.gold24kSellPerGram
  const prompt = {
    context: zakatResult.zakatable >= goldNisab ? ('both' as const) : zakatResult.zakatable >= silverNisab ? ('silverOnly' as const) : ('none' as const),
    silverNisab: formatWhole(silverNisab),
    goldNisab: formatWhole(goldNisab),
  }

  const pocketVMs = useMemo<PocketVM[]>(
    () => pockets.map((account) => {
      const linked = goals.filter((g) => g.status === 'active' && g.linkedSavingsAccountIds.includes(account.id))
      return {
        account,
        coverAmount: coverPocketIds.includes(account.id) ? account.currentBalance : 0,
        goalsAmount: Math.min(account.currentBalance, linked.reduce((s, g) => s + (g.targetAmount ?? 0), 0)),
        goalLabel: linked[0]?.name ?? '',
      }
    }),
    [pockets, goals, coverPocketIds],
  )

  // The v9 band shows no net worth; the hook still writes today's snapshot, as it did when the trend was shown.
  useNetWorthTrend(nw.netWorth, base, dataReady && !model.anyUnpriced && !nw.netWorthIncomplete, netWorthBasisOf(nw))

  // Final-ui v9 sections: savings goals (running and paused) own their parts; every other savings row is a pocket.
  const savingGoals = useMemo(() => {
    const { running, paused } = partitionGoals(goalRows)
    return [...running, ...paused].filter((r) => r.goal.category !== 'debt_freedom' && r.goal.category !== 'spending_control')
  }, [goalRows])
  const goalPartIds = useMemo(
    () => new Set(savingGoals.flatMap((r) => partsOfGoal(r.goal, savingsAccounts).map((p) => p.id))),
    [savingGoals, savingsAccounts],
  )
  const pocketItems = useMemo<PocketItem[]>(
    () => model.rows
      .filter((r) => r.account?.category === 'savings' && !goalPartIds.has(r.id) && !(isMonthlySavingsPart(r.account) && !(r.account.currentBalance > 0)))
      .map((r) => ({ account: r.account!, amount: r.amount })),
    [model.rows, goalPartIds],
  )
  const investmentRows = useMemo(() => model.rows.filter((r) => r.source === 'holding' || r.account?.category === 'investment'), [model.rows])
  const savingsAccountsInfo = useMemo(() => {
    const list = accountsModel.accounts.filter((a) => a.method.isSavings && !a.method.closedAt)
    const total = list.reduce((sum, a) => sum + (a.balance ? tryConvertCurrency(a.balance.balance, a.balance.currency, base, exchangeRates) ?? 0 : 0), 0)
    return { count: list.length, total }
  }, [accountsModel.accounts, base, exchangeRates])

  // Hero legend (v9): Pockets · Goals · Investments, by value.
  const split = useMemo<HeroSplitSegment[]>(() => {
    const by = { pockets: 0, goals: 0, investments: 0 }
    for (const r of model.rows) {
      if (r.amount == null) continue
      if (r.source === 'holding' || r.account?.category === 'investment') by.investments += r.amount
      else if (goalPartIds.has(r.id)) by.goals += r.amount
      else by.pockets += r.amount
    }
    const pct = (v: number) => (model.total > 0 ? (v / model.total) * 100 : 0)
    const seg = (key: keyof typeof by, label: string): HeroSplitSegment => ({ key, label, value: formatWhole(by[key]), pct: pct(by[key]) })
    return [seg('pockets', v9.pockets), seg('goals', v9.goals), seg('investments', v9.investments)].filter((x) => x.pct > 0)
  }, [model, goalPartIds, v9])

  // "+X added in November": this month's deposits into savings, the same figure Insights reports.
  const addedNote = useMemo(() => {
    const n = cashSavingsDepositsInBaseForMonth(savingsTransactions, monthFilter, settings.monthStartDay, base, exchangeRates, { pricePerGram: goldPricePerGram, available: goldOk })
    if (!(n > 0)) return null
    const month = monthNames(locale)[Number(monthFilter.slice(5, 7)) - 1]
    return <span>{v9.added(formatWhole(n), month)}</span>
  }, [savingsTransactions, monthFilter, settings.monthStartDay, base, exchangeRates, goldPricePerGram, goldOk, locale, v9])

  const devBypass = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === '1'
  const guard = (fn: () => void) => (devBypass ? fn() : requireAuth(fn, 'Sign in to manage savings'))
  const openAdd = (id?: string | null) => guard(() => { setPrefillId(id ?? null); setAddOpen(true) })
  const openWithdraw = (id?: string | null) => guard(() => { setPrefillId(id ?? null); setWithdrawOpen(true) })
  const openHolding = (preset: InvestmentAssetType | null = null) => guard(() => setHoldingOpen({ preset }))

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  const unpricedGrams = model.rows.filter((r) => r.cat === 'gold' && r.amount == null).reduce((s, r) => s + (r.quantity ?? 0), 0)
  const totalText = formatWhole(model.total)
  // Whole units, as the mockup ("103,907"); the sign stays for a negative net worth.
  const netWorthText = nw.netWorth < 0 ? `−${formatWhole(Math.abs(nw.netWorth))}` : formatWhole(nw.netWorth)
  const hasZakat = (zakatYear.state === 'estimate' || zakatYear.state === 'dueNow') && zakatYear.result.nisab > 0

  /** The Monthly saving row (final-ui v9): this month's leftover, placed of leftover, or what was overspent. */
  function monthlyRow(v: typeof monthEnd.view): MonthlySavingRowProps {
    const open = () => guard(() => setMonthEndOpen(true))
    if (!v || v.figures.reason || v.status === 'undone') return { title: mc.rowTitle, subtitle: mc.rowIdle, amount: null, onOpen: open }
    const month = monthNames(locale)[Number(v.cycleStart.slice(5, 7)) - 1]
    const d = (iso: string | null) => (iso ? formatLocalized(new Date(iso), 'd MMM', locale) : '')
    const left = v.figures.leftover
    if (v.status === 'empty') {
      return { title: mc.rowTitle, subtitle: mc.rowOverspent(month, formatWhole(Math.abs(left))), amount: <span className="font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-amber)]">−{formatWhole(Math.abs(left))}</span>, progress: 0, onOpen: open }
    }
    const placed = v.lines.reduce((s, l) => s + l.amountBase, 0)
    const amount = <span className="font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-text-primary)]">{formatWhole(placed)}<span className="text-[var(--color-brand-text-muted)]"> / {formatWhole(left)}</span></span>
    const subtitle = v.status === 'applied' ? mc.rowApplied(month, d(v.appliedAt))
      : v.figures.notPlaced > 0 ? mc.rowPendingShort(month, formatWhole(v.figures.notPlaced), d(v.autoApplyAt)) : mc.rowPending(month, d(v.autoApplyAt))
    return { title: mc.rowTitle, subtitle, amount, progress: left > 0 ? (placed / left) * 100 : 0, onOpen: open }
  }

  /** The warning follows what the delete does to net worth, not the kind of pocket. */
  const deleteBodyFor = (a: SavingsAccount) => {
    if (!(a.currentBalance > 0)) return t.deleteBody
    const state = useFinanceStore.getState()
    const effect = pocketDeleteEffect(state, a.id)
    if (effect.kind === 'leaves') return t.deleteBodyBalance(`${formatWhole(effect.amount)} ${effect.currency}`)
    const names = effect.kind === 'stays' ? state.paymentMethods.filter((m) => effect.accountIds.includes(m.id)).map(accountTitle) : []
    if (names.length === 0) return t.deleteBody
    return t.deleteBodyStays(`${formatWhole(a.currentBalance)} ${a.currency}`, new Intl.ListFormat(locale, { type: 'conjunction' }).format(names))
  }

  const askDelete = async (r: WealthRowVM) => {
    const a = r.account
    if (a) {
      const verdict = canDeletePocket(useFinanceStore.getState(), a.id)
      if (!verdict.ok) {
        const isDefault = verdict.reason === 'default'
        await alertDialog(verdict.reason === 'system'
          ? { title: t.deleteDefaultTitle, body: t.deleteSystemBody }
          : { title: isDefault ? t.deleteDefaultTitle : t.deleteOnlyTitle, body: isDefault ? t.deleteDefaultBody : t.deleteOnlyBody })
        return
      }
    }
    const body = a ? deleteBodyFor(a) : t.deleteBody
    if (!(await confirmDialog({ title: t.deleteTitle(r.title), body, destructive: true }))) return
    const undo = a ? deletePocketWithUndo(a.id) : deleteHoldingWithUndo(r.id)
    showToast(t.deletedToast(r.title), { undo, undoLabel: t.deleteUndo })
  }

  return (
    <div>
      {unpricedGrams > 0 ? (
        <StatusPill
          icon={<TriangleAlert strokeWidth={2} />}
          label={t.priceFeedDown(`${formatWhole(unpricedGrams)} g`)}
          visible={!feedHidden}
          onHide={hideFeed}
        />
      ) : null}
      <FlowStickyStrip visible={collapsed} primary={totalText} secondary={base} right={[netWorthText]} />
      {goldNisab > 0 ? <ZakatBasisPrompt {...prompt} /> : null}

      <PageHero inset>
      <SavingsHero
        total={totalText}
        currency={base}
        totalPrefix={model.anyUnpriced ? 'At least' : undefined}
        split={split}
        label={v9.heroLabel}
        note={addedNote}
      />
      </PageHero>

      <PageGrid
          stack
          className="pt-4"
          primary={
            <div className="space-y-5">
              <MonthlySavingRow {...monthlyRow(monthEnd.view)} />

              <PocketsSection
                pockets={pocketItems}
                methods={paymentMethods}
                currency={base}
                onOpen={(a) => guard(() => setPocketOpen(a.id))}
                onAdd={() => openHolding()}
              />

              <GoalsSection rows={savingGoals} onOpen={() => navigate('/goals')} onGoals={() => navigate('/goals')} />

              <SavingsAccountsSection count={savingsAccountsInfo.count} total={savingsAccountsInfo.total} currency={base} onOpen={() => navigate('/accounts')} />

              <WealthList
                rows={investmentRows}
                currency={base}
                onRowPress={(row, anchor) => setMenu({ row, anchor })}
                onAdd={() => guard(() => setHoldingOpen({ preset: null, investment: true }))}
                heading={{ title: v9.investments, count: investmentRows.length, addLabel: v9.add }}
              />
            </div>
          }
          secondary={
            <div className="mt-1 lg:mt-0">
              <WealthPlanRows
                emergency={{ state: efState, months: emergency.monthsCovered.toFixed(1), target: targetMonths }}
                zakat={hasZakat ? { amount: formatWhole(zakatYear.result.zakat), due: hawl.isPlaceholder ? '' : formatLocalized(parseDateOnly(hawl.dueDate), 'd MMM', locale) } : undefined}
                onOpenEmergency={() => guard(() => setEmergencyOpen(true))}
                onOpenZakat={() => guard(() => setZakatOpen(true))}
              />
            </div>
          }
        />

      {menu && (() => {
        const { row } = menu
        const a = row.account
        return (
          <CardActionMenu
            anchor={menu.anchor}
            title={row.title}
            onClose={() => setMenu(null)}
            items={[
              ...(a && a.category === 'savings'
                ? [
                    { label: t.menuAddMoney, icon: <ArrowDownLeft size={17} />, onSelect: () => openAdd(a.id) },
                    { label: t.menuWithdraw, icon: <ArrowUpRight size={17} />, onSelect: () => openWithdraw(a.id) },
                  ]
                : []),
              ...(a ? [{ label: t.menuEdit, icon: <Pencil size={17} />, onSelect: () => setEditAcc(a) }] : []),
              ...(row.cat === 'gold' ? [{ label: wl.refreshGold, icon: <RefreshCw size={17} />, onSelect: () => void refreshPrices() }] : []),
              {
                label: t.menuDelete, icon: <Trash2 size={17} />, destructive: true,
                onSelect: () => void askDelete(row),
              },
            ]}
          />
        )
      })()}

      {showAdd && (
        <AddSavingsSheetV3 open onClose={() => { setAddOpen(false); setPrefillId(null); useSettingsStore.getState().setWealthAddRequested(false) }} pockets={pocketVMs} defaultAccountId={prefillId} leftToSpend={stats.leftToSpend} />
      )}
      {withdrawOpen && (
        <WithdrawSheetV3
          open onClose={() => { setWithdrawOpen(false); setPrefillId(null) }} pockets={pocketVMs} defaultAccountId={prefillId}
          onNeedAsset={(type) => { setWithdrawOpen(false); setPrefillId(null); openHolding(type) }}
        />
      )}
      {holdingOpen && <AddHoldingSheet open presetAssetType={holdingOpen.preset} initialTab={holdingOpen.investment ? 'investment' : undefined} onClose={() => setHoldingOpen(null)} />}
      {emergencyOpen && (
        <EmergencyFundSheet
          open mode={efState === 'unset' ? 'edit' : 'details'} onClose={() => setEmergencyOpen(false)}
          onAddMoney={() => { setEmergencyOpen(false); openAdd(null) }}
        />
      )}
      {monthEndOpen && <MonthEndSheet open monthEnd={monthEnd} onClose={() => { setMonthEndOpen(false); setMonthEndSplit(false) }} focusSplit={monthEndSplit || !monthEnd.view} />}
      {zakatOpen && <ZakatSheet open onClose={() => setZakatOpen(false)} sources={zakatSources} year={zakatYear} hawlDate={hawlDate} />}
      {pocketOpen && (() => {
        const a = savingsAccounts.find((x) => x.id === pocketOpen)
        if (!a) return null
        const close = () => setPocketOpen(null)
        return (
          <PocketSheet
            account={a}
            onClose={close}
            onAddMoney={(p) => { close(); openAdd(p.id) }}
            onRelease={(p) => { close(); setReleaseOf(p) }}
            onWithdraw={(p) => { close(); openWithdraw(p.id) }}
            onEdit={(p) => { close(); setEditAcc(p) }}
            onSplit={() => { close(); setMonthEndSplit(true); setMonthEndOpen(true) }}
            onDelete={(p) => {
              const row = model.rows.find((r) => r.id === p.id)
              if (row) { close(); void askDelete(row) }
            }}
          />
        )
      })()}
      {releaseOf && <ReleaseSheet account={releaseOf} onClose={() => setReleaseOf(null)} />}
      {editAcc && <EditSavingsAccountSheet open account={editAcc} onClose={() => setEditAcc(null)} />}
    </div>
  )
}
