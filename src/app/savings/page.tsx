'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Target, Pencil, Trash2, Plus } from 'lucide-react'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useNetWorth } from '@/hooks/useNetWorth'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useHydrateSavings, useHydrateGoals } from '@/hooks/remote'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { SavingsHero } from '@/components/features/savings-v3/SavingsHero'
import { PocketsCarousel, type PocketVM } from '@/components/features/savings-v3/PocketsCarousel'
import { EmergencyFundCard } from '@/components/features/savings-v3/EmergencyFundCard'
import { EmergencyFundSheet } from '@/components/features/savings-v3/EmergencyFundSheet'
import { ZakatCard } from '@/components/features/savings-v3/ZakatCard'
import { ZakatSheet } from '@/components/features/savings-v3/ZakatSheet'
import { InvestmentView } from '@/components/features/savings-v3/InvestmentView'
import { AddInvestmentSheet } from '@/components/features/savings-v3/AddInvestmentSheet'
import { ActivityLedger } from '@/components/features/savings-v3/ActivityLedger'
import type { InvestmentAssetType } from '@/lib/store/types'
import { computeEmergencyFund } from '@/lib/savings/emergencyFund'
import { computeZakat } from '@/lib/savings/zakat'
import { deriveZakatBase } from '@/lib/savings/zakatInputs'
import { useAssetPrices } from '@/hooks/useAssetPrices'
import { deriveSimpleMonth } from '@/lib/savings/simpleMonth'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import { AddSavingsSheetV3 } from '@/components/features/savings-v3/AddSavingsSheetV3'
import { WithdrawSheetV3 } from '@/components/features/savings-v3/WithdrawSheetV3'
import { UpdateBalanceSheet } from '@/components/features/savings/UpdateBalanceSheet'
import { NewPocketSheet } from '@/components/features/savings-v3/NewPocketSheet'
import { EditSavingsAccountSheet } from '@/components/modals/EditSavingsAccountSheet'
import { savingsPace } from '@/lib/savings/savingsPace'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { convertCurrency } from '@/lib/utils/currency'
import type { SavingsAccount } from '@/lib/store/types'

export default function SavingsPage() {
  useHydrateSavings()
  useHydrateGoals()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const requireAuth = useRequireAuthAction()
  const nw = useNetWorth()
  const stats = useMonthlyStats()

  const { lookup } = useAssetPrices()
  const { savingsAccounts, savingsTransactions, investmentHoldings, goals, profile, settings, exchangeRates, budgetPlans, activeBudgetPlanId, debts, goldPricePerGram, goldPriceAvailable, correctSavingsBalance } = useFinanceStore(
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
      debts: s.debts,
      goldPricePerGram: s.goldPricePerGram,
      goldPriceAvailable: s.goldPriceAvailable,
      correctSavingsBalance: s.correctSavingsBalance,
    })),
  )

  const [addOpen, setAddOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [newAccountOpen, setNewAccountOpen] = useState(false)
  const [editAcc, setEditAcc] = useState<SavingsAccount | null>(null)
  const [updateAcc, setUpdateAcc] = useState<SavingsAccount | null>(null)
  const [prefillId, setPrefillId] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ id: string; anchor: DOMRect } | null>(null)
  const confirmDialog = useConfirm()
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [zakatOpen, setZakatOpen] = useState(false)
  const [view, setView] = useState<'savings' | 'investment'>('savings')
  const [addInvestOpen, setAddInvestOpen] = useState(false)
  const [addInvestType, setAddInvestType] = useState<InvestmentAssetType | null>(null)

  const pockets = useMemo(
    () => savingsAccounts.filter((a) => a.category === 'savings'),
    [savingsAccounts],
  )

  // Emergency fund: cover = the cover pockets' balances; essentials = a "simple month".
  const goldOk = goldPriceAvailable !== false
  const coverPocketIds = useMemo(() => {
    const cfg = profile.emergencyFundConfig
    return cfg?.coverPocketIds ?? pockets.filter((a) => a.isEmergencyCover).map((a) => a.id)
  }, [profile.emergencyFundConfig, pockets])
  const coverAmount = useMemo(() =>
    pockets.filter((a) => coverPocketIds.includes(a.id))
      .reduce((s, a) => s + (savingsAccountBalanceInBase(a, settings.baseCurrency, exchangeRates, goldPricePerGram, goldOk) ?? 0), 0),
    [pockets, coverPocketIds, settings.baseCurrency, exchangeRates, goldPricePerGram, goldOk])
  const simpleMonth = useMemo(() =>
    deriveSimpleMonth({ profile, activePlan: budgetPlans.find((p) => p.id === activeBudgetPlanId) ?? budgetPlans[0], debts, baseCurrency: settings.baseCurrency, exchangeRates, override: profile.emergencyFundConfig?.monthlyEssentials }),
    [profile, budgetPlans, activeBudgetPlanId, debts, settings.baseCurrency, exchangeRates])
  const targetMonths = profile.emergencyFundConfig?.targetMonths ?? 3
  const emergency = useMemo(() => computeEmergencyFund({ coverAmount, monthlyEssentials: simpleMonth.total, targetMonths }), [coverAmount, simpleMonth.total, targetMonths])

  // Zakat
  const zakatBase = useMemo(() => deriveZakatBase({ savingsAccounts, investmentHoldings, debts, baseCurrency: settings.baseCurrency, exchangeRates, goldPricePerGram, goldPriceAvailable: goldOk, lookup }),
    [savingsAccounts, investmentHoldings, debts, settings.baseCurrency, exchangeRates, goldPricePerGram, goldOk, lookup])
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
      nisabBasis: zc?.nisabBasis ?? 'silver',
      gold24kSellPerGram: zakatBase.gold24kSellPerGram,
      silverPerGram: zakatBase.silverPerGram,
      manualAmount: zc?.manualAmount ?? null,
    })
  }, [zakatBase, profile.zakatConfig])
  // Hawl date: a lunar year (~354 days) from the last paid date or account creation.
  const hawlDate = useMemo(() => {
    const start = profile.zakatConfig?.lastPaidDate ?? profile.createdAt
    const d = new Date(new Date(start).getTime() + 354 * 24 * 3600 * 1000)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }, [profile.zakatConfig?.lastPaidDate, profile.createdAt])

  const pocketVMs = useMemo<PocketVM[]>(() => {
    return pockets.map((account) => {
      const linked = goals.filter(
        (g) => g.status === 'active' && g.linkedSavingsAccountIds.includes(account.id),
      )
      const goalsAmount = Math.min(
        account.currentBalance,
        linked.reduce((s, g) => s + (g.targetAmount ?? 0), 0),
      )
      const goalLabel =
        linked.length === 0
          ? account.isEmergencyCover
            ? 'Emergency cover'
            : 'No goal attached'
          : linked.length === 1
            ? linked[0].name
            : `${linked[0].name} + ${linked.length - 1} more`
      return {
        account,
        coverAmount: coverPocketIds.includes(account.id) ? account.currentBalance : 0,
        goalsAmount,
        goalLabel,
        isAuto: profile.defaultCarryPocketId === account.id || account.type === 'vault',
      }
    })
  }, [pockets, goals, profile.defaultCarryPocketId, coverPocketIds])

  // Real net worth — same figure the dashboard shows (savings + investments + this month's
  // flow − debt), not just balances. Binding to totalSavings+totalInvestments read 0 for a
  // user with income but nothing yet saved.
  const heroUsd = useMemo(
    () => convertCurrency(nw.netWorth, settings.baseCurrency, 'USD', exchangeRates),
    [nw.netWorth, settings.baseCurrency, exchangeRates],
  )
  // ponytail: trailing-average pace uses this month vs itself until month-history wiring lands.
  const pace = savingsPace(stats.savingsThisMonth, stats.savingsThisMonth)

  const devBypass =
    process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === '1'
  const guard = (fn: () => void) => (devBypass ? fn() : requireAuth(fn, 'Sign in to manage savings'))
  const openAdd = (id?: string | null) => guard(() => { setPrefillId(id ?? null); setAddOpen(true) })
  const openWithdraw = (id?: string | null) => guard(() => { setPrefillId(id ?? null); setWithdrawOpen(true) })

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  if (view === 'investment') {
    return (
      <>
        <InvestmentView
          onBackToSavings={() => setView('savings')}
          onAddInvestment={(t) => guard(() => { setAddInvestType(t); setAddInvestOpen(true) })}
        />
        {addInvestOpen && <AddInvestmentSheet open presetType={addInvestType} onClose={() => setAddInvestOpen(false)} />}
      </>
    )
  }

  const empty = pockets.length === 0

  return (
    <div className="pb-24">
      <div className="pt-3 space-y-4">
        <SavingsHero
          netWorth={nw.netWorth}
          netWorthUsd={heroUsd}
          incomplete={nw.netWorthIncomplete}
          totalSaved={nw.totalSavings}
          thisMonth={stats.savingsThisMonth}
          investment={nw.totalInvestments}
          pace={pace}
          currency={settings.baseCurrency}
          empty={empty}
          onAddSavings={() => openAdd(null)}
          onInvestment={() => setView('investment')}
        />

        {empty ? (
          <div className="mx-4 rounded-[18px] border border-dashed border-[var(--color-brand-border)] p-6 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'rgba(126,174,249,.14)' }}>
              <Target className="h-6 w-6" style={{ color: '#7EAEF9' }} />
            </span>
            <p className="text-base font-semibold text-[var(--color-brand-text-primary)]">No pockets yet</p>
            <p className="mx-auto mt-1 max-w-[16rem] text-sm text-[var(--color-brand-text-secondary)]">
              A pocket is wherever money actually sits — a bank account, cash in a safe, a certificate.
            </p>
            <button
              type="button"
              onClick={() => guard(() => setNewAccountOpen(true))}
              className="mt-4 rounded-xl px-5 py-3 text-sm font-semibold text-white"
              style={{ background: '#E50914' }}
            >
              Create a pocket
            </button>
          </div>
        ) : (
          <section>
            <div className="flex items-center gap-2 px-4">
              <h2 className="text-[15px] font-bold text-[var(--color-brand-text-primary)]">Pockets</h2>
              <span className="inline-flex h-5 min-w-[21px] items-center justify-center rounded-full bg-[var(--color-brand-elevated)] px-1.5 font-mono-numbers text-[11px] font-semibold text-[var(--color-brand-text-secondary)]">
                {pockets.length}
              </span>
              <button
                type="button" aria-label="Add a pocket"
                onClick={() => guard(() => setNewAccountOpen(true))}
                className="ms-auto flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]"
              >
                <Plus size={16} />
              </button>
            </div>
            <PocketsCarousel
              pockets={pocketVMs}
              onAdd={openAdd}
              onWithdraw={openWithdraw}
              onMenu={(id, anchor) => setMenu({ id, anchor })}
              onAddPocket={() => guard(() => setNewAccountOpen(true))}
            />

            {simpleMonth.total > 0 && (
              <div className="mt-3">
                <EmergencyFundCard
                  monthsCovered={emergency.monthsCovered}
                  targetMonths={targetMonths}
                  coverAmount={coverAmount}
                  gap={emergency.gap}
                  atOrAboveTarget={emergency.atOrAboveTarget}
                  onOpen={() => guard(() => setEmergencyOpen(true))}
                />
              </div>
            )}
            <ZakatCard result={zakatResult} base={zakatResult.zakatable} hawlDate={hawlDate} onOpen={() => guard(() => setZakatOpen(true))} />

            <div className="mt-4">
              <ActivityLedger transactions={savingsTransactions} accounts={pockets} baseCurrency={settings.baseCurrency} exchangeRates={exchangeRates} />
            </div>
          </section>
        )}
      </div>

      {menu && (() => {
        const a = pockets.find((p) => p.id === menu.id)
        if (!a) return null
        return (
          <CardActionMenu
            anchor={menu.anchor}
            title={a.name}
            onClose={() => setMenu(null)}
            items={[
              { label: 'Edit', icon: <Pencil size={17} />, onSelect: () => setEditAcc(a) },
              {
                label: 'Delete', icon: <Trash2 size={17} />, destructive: true,
                onSelect: async () => {
                  if (await confirmDialog({ title: `Delete ${a.name}?`, body: 'This removes the pocket and its history. This cannot be undone.', destructive: true })) {
                    useFinanceStore.getState().deleteSavingsAccount(a.id)
                  }
                },
              },
            ]}
          />
        )
      })()}

      {addOpen && (
        <AddSavingsSheetV3
          open onClose={() => { setAddOpen(false); setPrefillId(null) }}
          pockets={pocketVMs} defaultAccountId={prefillId}
          leftToSpend={stats.leftToSpend}
        />
      )}
      {withdrawOpen && (
        <WithdrawSheetV3
          open onClose={() => { setWithdrawOpen(false); setPrefillId(null) }}
          pockets={pocketVMs} defaultAccountId={prefillId}
          onNeedAsset={(t) => { setWithdrawOpen(false); setPrefillId(null); setAddInvestType(t); setAddInvestOpen(true) }}
        />
      )}
      {updateAcc && (
        <UpdateBalanceSheet
          key={updateAcc.id} open onClose={() => setUpdateAcc(null)}
          account={updateAcc}
          onCorrect={(nb, notes) => correctSavingsBalance(updateAcc.id, nb, notes)}
        />
      )}
      {newAccountOpen && <NewPocketSheet open onClose={() => setNewAccountOpen(false)} />}
      {emergencyOpen && <EmergencyFundSheet open onClose={() => setEmergencyOpen(false)} />}
      {zakatOpen && <ZakatSheet open onClose={() => setZakatOpen(false)} base={zakatBase} hawlDate={hawlDate} />}
      {editAcc && (
        <EditSavingsAccountSheet open account={editAcc} onClose={() => setEditAcc(null)} />
      )}
    </div>
  )
}
