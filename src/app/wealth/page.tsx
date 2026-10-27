'use client'

import { countedDebtPayments, countedDebts } from '@/lib/spending/exclusion'
import { selectActivePlan } from '@/lib/budget/activePlan'
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Star, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { StatusPill } from '@/components/ui/StatusPill'
import { useAlert, useConfirm } from '@/components/ui/dialog/DialogProvider'
import { PageGrid } from '@/components/layout/PageGrid'
import { FlowStickyStrip } from '@/components/features/flow/FlowStickyStrip'
import { ActivityLedger } from '@/components/features/savings-v3/ActivityLedger'
import { AddHoldingSheet } from '@/components/features/savings-v3/AddHoldingSheet'
import { AddSavingsSheetV3 } from '@/components/features/savings-v3/AddSavingsSheetV3'
import { EmergencyFundSheet } from '@/components/features/savings-v3/EmergencyFundSheet'
import { GoldPriceStrip } from '@/components/features/savings-v3/GoldPriceStrip'
import { SavingsHero, type HeroSplitSegment } from '@/components/features/savings-v3/SavingsHero'
import { WealthHeroBadges } from '@/components/features/savings-v3/WealthHeroBadges'
import { WealthList } from '@/components/features/savings-v3/WealthList'
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
import { useNetWorthTrend } from '@/hooks/useNetWorthTrend'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { canDeletePocket } from '@/lib/savings/canDeletePocket'
import { useT } from '@/lib/i18n'
import { buildGoalProgressContext, computeGoalProgress } from '@/lib/goals/computeGoalProgress'
import { computeEmergencyFund } from '@/lib/savings/emergencyFund'
import { deriveHawl } from '@/lib/savings/hawl'
import { deriveSimpleMonth } from '@/lib/savings/simpleMonth'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import { buildWealth, emergencyState, savingsRatePct, type CatKey, type WealthRowVM } from '@/lib/savings/wealthModel'
import { computeZakat } from '@/lib/savings/zakat'
import { deriveZakatBase } from '@/lib/savings/zakatInputs'
import { zakatAccountsFromLedger } from '@/lib/savings/zakatAccounts'
import { useLedgerInput } from '@/lib/accounts/useAccounts'
import { effectiveNisabBasis } from '@/lib/savings/zakatBasis'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { InvestmentAssetType, SavingsAccount } from '@/lib/store/types'
import { formatWhole } from '@/lib/utils/formatters'

/** Past this scroll the band's detail has left the viewport: collapse into the sticky strip. */
const COLLAPSE_AT = 150

export default function WealthPage() {
  useEnsureMonthlySavingsVault()
  const t = useT().wealthPage
  const dataReady = useFinanceStore((s) => s.dataReady)
  const requireAuth = useRequireAuthAction()
  const confirmDialog = useConfirm()
  const alertDialog = useAlert()
  const nw = useNetWorth()
  const stats = useMonthlyStats()
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const { lookup } = useAssetPrices()
  const {
    savingsAccounts, savingsTransactions, investmentHoldings, goals, profile, settings, exchangeRates,
    budgetPlans, activeBudgetPlanId, debts, goldPricePerGram, goldPriceAvailable, expenses, debtPayments,
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
      expenses: s.expenses,
      debtPayments: countedDebtPayments(s.debtPayments, s.debts, s.paymentMethods),
    })),
  )
  const base = settings.baseCurrency
  const goldOk = goldPriceAvailable !== false

  const [addOpen, setAddOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [holdingOpen, setHoldingOpen] = useState<{ preset: InvestmentAssetType | null } | null>(null)
  const [editAcc, setEditAcc] = useState<SavingsAccount | null>(null)
  const [prefillId, setPrefillId] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ row: WealthRowVM; anchor: DOMRect } | null>(null)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [zakatOpen, setZakatOpen] = useState(false)
  const [filter, setFilter] = useState<CatKey | null>(null)
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
  const zakatBase = useMemo(
    () => deriveZakatBase({
      savingsAccounts, investmentHoldings, debts, debtPayments, baseCurrency: base, exchangeRates, goldPricePerGram, goldPriceAvailable: goldOk, lookup,
      ...zakatAccountsFromLedger(ledger),
    }),
    [savingsAccounts, investmentHoldings, debts, debtPayments, base, exchangeRates, goldPricePerGram, goldOk, lookup, ledger],
  )
  const zakatResult = useMemo(() => {
    const zc = profile.zakatConfig
    const ov = zc?.lineOverrides ?? {}
    return computeZakat({
      cashAndSavings: ov.cash ?? zakatBase.cashAndSavings,
      goldValue: ov.gold ?? zakatBase.goldValue,
      cryptoValue: ov.crypto ?? zakatBase.cryptoValue,
      stocksValue: ov.stocks ?? zakatBase.stocksValue,
      debtsDueThisYear: ov.debts ?? zakatBase.debtsDueThisYear,
      holdsForTrading: zc?.holdsForTrading ?? false,
      nisabBasis: effectiveNisabBasis(zc),
      gold24kSellPerGram: zakatBase.gold24kSellPerGram,
      silverPerGram: zakatBase.silverPerGram,
      manualAmount: zc?.manualAmount ?? null,
    })
  }, [zakatBase, profile.zakatConfig])
  const hawl = useMemo(
    () => deriveHawl({ yearStartDate: profile.zakatConfig?.yearStartDate, lastPaidDate: profile.zakatConfig?.lastPaidDate, createdAt: profile.createdAt }),
    [profile.zakatConfig?.yearStartDate, profile.zakatConfig?.lastPaidDate, profile.createdAt],
  )
  const hawlDate = useMemo(() => new Date(hawl.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), [hawl.dueDate])
  const silverNisab = 595 * zakatBase.silverPerGram
  const goldNisab = 85 * zakatBase.gold24kSellPerGram
  const prompt = {
    context: zakatResult.zakatable >= goldNisab ? ('both' as const) : zakatResult.zakatable >= silverNisab ? ('silverOnly' as const) : ('none' as const),
    silverNisab: formatWhole(silverNisab),
    goldNisab: formatWhole(goldNisab),
  }

  // Goals as a lens: a pocket's sub-line names the first active goal it feeds.
  const goalLines = useMemo(() => {
    const ctx = buildGoalProgressContext({ savingsAccounts, debts, debtPayments, expenses, exchangeRates, goldPricePerGram, goldPriceAvailable, settings }, monthFilter)
    const lines: Record<string, string> = {}
    for (const a of pockets) {
      const g = goals.find((x) => x.status === 'active' && x.linkedSavingsAccountIds.includes(a.id))
      if (!g) continue
      const pct = g.targetAmount ? Math.min(100, Math.round((computeGoalProgress(g, ctx) / g.targetAmount) * 100)) : 0
      lines[a.id] = t.feeds(g.name, pct)
    }
    return lines
  }, [pockets, goals, savingsAccounts, debts, debtPayments, expenses, exchangeRates, goldPricePerGram, goldPriceAvailable, settings, monthFilter, t])

  const pocketVMs = useMemo<PocketVM[]>(
    () => pockets.map((account) => {
      const linked = goals.filter((g) => g.status === 'active' && g.linkedSavingsAccountIds.includes(account.id))
      return {
        account,
        coverAmount: coverPocketIds.includes(account.id) ? account.currentBalance : 0,
        goalsAmount: Math.min(account.currentBalance, linked.reduce((s, g) => s + (g.targetAmount ?? 0), 0)),
        goalLabel: linked[0]?.name ?? '',
        isAuto: profile.defaultCarryPocketId === account.id,
      }
    }),
    [pockets, goals, coverPocketIds, profile.defaultCarryPocketId],
  )

  const trendRaw = useNetWorthTrend(nw.netWorth, base, dataReady && !model.anyUnpriced, nw.accountsTotal != null ? 'accounts' : 'legacy')
  const trend = trendRaw ? { points: trendRaw.points, dir: trendRaw.dir, pct: `${Math.abs(trendRaw.pct).toFixed(1)}%` } : undefined

  const split = useMemo<HeroSplitSegment[]>(() => {
    const pct = (v: number) => (model.total > 0 ? (v / model.total) * 100 : 0)
    const seg = (key: string, label: string, v: number, ret?: string): HeroSplitSegment => ({ key, label, value: formatWhole(v), pct: pct(v), ret })
    const { balance, market, self } = model.byPricing
    if (market + self > 0) {
      return [
        seg('balance', t.balances, balance),
        seg('market', t.marketPriced, market, model.investReturnPct != null ? `${Math.abs(model.investReturnPct).toFixed(1)}%` : undefined),
        ...(self > 0 ? [seg('self', t.youValue, self)] : []),
      ]
    }
    const k = model.byKind
    return [
      seg('bank', t.bankAccounts, k.bank),
      seg('vault', t.vault, k.vault),
      seg('cash', t.cash, k.cash),
      ...(k.other > 0 ? [seg('other', t.other, k.other)] : []),
    ].filter((s) => s.pct > 0 || model.total === 0)
  }, [model, t])

  const devBypass = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === '1'
  const guard = (fn: () => void) => (devBypass ? fn() : requireAuth(fn, 'Sign in to manage savings'))
  const openAdd = (id?: string | null) => guard(() => { setPrefillId(id ?? null); setAddOpen(true) })
  const openWithdraw = (id?: string | null) => guard(() => { setPrefillId(id ?? null); setWithdrawOpen(true) })
  const openHolding = (preset: InvestmentAssetType | null = null) => guard(() => setHoldingOpen({ preset }))

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  const brandNew = model.rows.length === 0
  const unpricedGrams = model.rows.filter((r) => r.cat === 'gold' && r.amount == null).reduce((s, r) => s + (r.quantity ?? 0), 0)
  const totalText = formatWhole(model.total)
  const netWorthText = formatWhole(nw.netWorth)
  const hasZakat = zakatResult.due && zakatResult.nisab > 0
  const rate = savingsRatePct(stats.savingsThisMonth, stats.totalIncome)

  const askDelete = async (r: WealthRowVM) => {
    const a = r.account
    if (a) {
      const verdict = canDeletePocket(useFinanceStore.getState(), a.id)
      if (!verdict.ok) {
        const isDefault = verdict.reason === 'default'
        await alertDialog({ title: isDefault ? t.deleteDefaultTitle : t.deleteOnlyTitle, body: isDefault ? t.deleteDefaultBody : t.deleteOnlyBody })
        return
      }
    }
    const body = a && a.currentBalance > 0 ? t.deleteBodyBalance(`${formatWhole(a.currentBalance)} ${a.currency}`) : t.deleteBody
    if (!(await confirmDialog({ title: t.deleteTitle(r.title), body, destructive: true }))) return
    if (a) useFinanceStore.getState().deleteSavingsAccount(a.id)
    else useFinanceStore.getState().deleteInvestmentHolding(r.id)
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

      <SavingsHero
        total={totalText}
        currency={base}
        totalPrefix={model.anyUnpriced ? 'At least' : undefined}
        netWorth={netWorthText}
        netWorthPrefix={nw.netWorthIncomplete ? 'At least' : undefined}
        split={split}
        netWorthTrend={model.anyUnpriced ? undefined : trend}
        savingsRate={rate ?? undefined}
        badges={
          <WealthHeroBadges
            emergency={{ state: efState, months: emergency.monthsCovered.toFixed(1), target: targetMonths }}
            zakat={hasZakat ? { amount: formatWhole(zakatResult.zakat), due: hawl.isPlaceholder ? '—' : new Date(hawl.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) } : undefined}
            onOpenEmergency={() => guard(() => setEmergencyOpen(true))}
            onOpenZakat={() => guard(() => setZakatOpen(true))}
          />
        }
      />

      <PageGrid
          className="pt-4 lg:pt-0"
          primary={
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 px-4 lg:px-0">
                {brandNew ? (
                  <>
                    <Button size="cta" onClick={() => openHolding()}><Plus />{t.addHolding}</Button>
                    <Button size="cta" variant="outline" onClick={() => openAdd(null)}><ArrowDownLeft />{t.addMoney}</Button>
                  </>
                ) : (
                  <>
                    <Button size="cta" onClick={() => openAdd(null)}><ArrowDownLeft />{t.addMoney}</Button>
                    <Button size="cta" variant="outline" onClick={() => openWithdraw(null)}><ArrowUpRight />{t.withdraw}</Button>
                  </>
                )}
              </div>

              <GoldPriceStrip />

              <WealthList
                rows={model.rows}
                categories={model.categories}
                filter={filter}
                onFilter={setFilter}
                onRowPress={(row, anchor) => setMenu({ row, anchor })}
                onAdd={() => openHolding()}
                goalLines={goalLines}
              />
            </div>
          }
          secondary={
            <div className="mt-1 lg:mt-0">
              <ActivityLedger transactions={savingsTransactions} accounts={savingsAccounts} baseCurrency={base} exchangeRates={exchangeRates} limit={3} filter={filter} />
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
              ...(a && a.category === 'savings' && profile.defaultCarryPocketId !== a.id
                ? [{ label: t.menuMakeDefault, icon: <Star size={17} />, onSelect: () => useFinanceStore.getState().updateProfile({ defaultCarryPocketId: a.id }) }]
                : []),
              {
                label: t.menuDelete, icon: <Trash2 size={17} />, destructive: true,
                onSelect: () => void askDelete(row),
              },
            ]}
          />
        )
      })()}

      {addOpen && (
        <AddSavingsSheetV3 open onClose={() => { setAddOpen(false); setPrefillId(null) }} pockets={pocketVMs} defaultAccountId={prefillId} leftToSpend={stats.leftToSpend} />
      )}
      {withdrawOpen && (
        <WithdrawSheetV3
          open onClose={() => { setWithdrawOpen(false); setPrefillId(null) }} pockets={pocketVMs} defaultAccountId={prefillId}
          onNeedAsset={(type) => { setWithdrawOpen(false); setPrefillId(null); openHolding(type) }}
        />
      )}
      {holdingOpen && <AddHoldingSheet open presetAssetType={holdingOpen.preset} onClose={() => setHoldingOpen(null)} />}
      {emergencyOpen && (
        <EmergencyFundSheet
          open mode={efState === 'unset' ? 'edit' : 'details'} onClose={() => setEmergencyOpen(false)}
          onAddMoney={() => { setEmergencyOpen(false); openAdd(null) }}
        />
      )}
      {zakatOpen && <ZakatSheet open onClose={() => setZakatOpen(false)} base={zakatBase} hawlDate={hawlDate} />}
      {editAcc && <EditSavingsAccountSheet open account={editAcc} onClose={() => setEditAcc(null)} />}
    </div>
  )
}
