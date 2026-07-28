'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Target } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useNetWorth } from '@/hooks/useNetWorth'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useHydrateSavings, useHydrateGoals } from '@/hooks/remote'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { SavingsHero } from '@/components/features/savings-v3/SavingsHero'
import { PocketsCarousel, type PocketVM } from '@/components/features/savings-v3/PocketsCarousel'
import { AddSavingsSheetV3 } from '@/components/features/savings-v3/AddSavingsSheetV3'
import { WithdrawFromSavingsSheet } from '@/components/features/savings/WithdrawFromSavingsSheet'
import { UpdateBalanceSheet } from '@/components/features/savings/UpdateBalanceSheet'
import { AddSavingsAccountSheet } from '@/components/modals/AddSavingsAccountSheet'
import { EditSavingsAccountSheet } from '@/components/modals/EditSavingsAccountSheet'
import { savingsPace } from '@/lib/savings/savingsPace'
import { convertCurrency } from '@/lib/utils/currency'
import type { SavingsAccount } from '@/lib/store/types'

export default function SavingsPage() {
  useHydrateSavings()
  useHydrateGoals()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const requireAuth = useRequireAuthAction()
  const nw = useNetWorth()
  const stats = useMonthlyStats()

  const { savingsAccounts, goals, profile, settings, exchangeRates,
    withdrawFromSavings, correctSavingsBalance } = useFinanceStore(
    useShallow((s) => ({
      savingsAccounts: s.savingsAccounts,
      goals: s.goals,
      profile: s.profile,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      withdrawFromSavings: s.withdrawFromSavings,
      correctSavingsBalance: s.correctSavingsBalance,
    })),
  )

  const [addOpen, setAddOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [newAccountOpen, setNewAccountOpen] = useState(false)
  const [editAcc, setEditAcc] = useState<SavingsAccount | null>(null)
  const [updateAcc, setUpdateAcc] = useState<SavingsAccount | null>(null)
  const [prefillId, setPrefillId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)

  const pockets = useMemo(
    () => savingsAccounts.filter((a) => a.category === 'savings'),
    [savingsAccounts],
  )

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
        coverAmount: 0, // refined in the emergency-fund slice
        goalsAmount,
        goalLabel,
        isAuto: profile.defaultCarryPocketId === account.id || account.type === 'vault',
      }
    })
  }, [pockets, goals, profile.defaultCarryPocketId])

  const heroBig = nw.totalSavings + nw.totalInvestments
  const heroUsd = useMemo(
    () => convertCurrency(heroBig, settings.baseCurrency, 'USD', exchangeRates),
    [heroBig, settings.baseCurrency, exchangeRates],
  )
  // ponytail: trailing-average pace uses this month vs itself until month-history wiring lands.
  const pace = savingsPace(stats.savingsThisMonth, stats.savingsThisMonth)

  const devBypass =
    process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === '1'
  const guard = (fn: () => void) => (devBypass ? fn() : requireAuth(fn, 'Sign in to manage savings'))
  const openAdd = (id?: string | null) => guard(() => { setPrefillId(id ?? null); setAddOpen(true) })
  const openWithdraw = (id?: string | null) => guard(() => { setPrefillId(id ?? null); setWithdrawOpen(true) })

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  const empty = pockets.length === 0

  return (
    <div className="pb-24">
      <div className="pt-3 space-y-4">
        <SavingsHero
          netWorth={heroBig}
          netWorthUsd={heroUsd}
          totalSaved={nw.totalSavings}
          thisMonth={stats.savingsThisMonth}
          investment={nw.totalInvestments}
          pace={pace}
          currency={settings.baseCurrency}
          empty={empty}
          onAddSavings={() => openAdd(null)}
          onInvestment={() => { /* Investment page — next slice */ }}
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
            </div>
            <PocketsCarousel
              pockets={pocketVMs}
              onAdd={openAdd}
              onWithdraw={openWithdraw}
              onMenu={(id) => setMenuId(id)}
            />
          </section>
        )}
      </div>

      {/* Kebab menu (Edit / Delete) — reuses existing edit sheet for now */}
      {menuId && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuId(null)}>
          <div
            className="absolute rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] py-1 shadow-xl"
            style={{ top: 220, right: 24, minWidth: 186 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="block w-full px-4 py-2.5 text-left text-sm text-[var(--color-brand-text-primary)]"
              onClick={() => { const a = pockets.find((p) => p.id === menuId) ?? null; setMenuId(null); setEditAcc(a) }}
            >
              Edit
            </button>
            <button
              type="button"
              className="block w-full px-4 py-2.5 text-left text-sm text-[var(--color-brand-red-text)]"
              onClick={() => {
                const a = pockets.find((p) => p.id === menuId)
                setMenuId(null)
                if (a && globalThis.confirm?.('Delete this pocket?')) useFinanceStore.getState().deleteSavingsAccount(a.id)
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {addOpen && (
        <AddSavingsSheetV3
          open onClose={() => { setAddOpen(false); setPrefillId(null) }}
          pockets={pocketVMs} defaultAccountId={prefillId}
          leftToSpend={stats.leftToSpend}
        />
      )}
      {withdrawOpen && (
        <WithdrawFromSavingsSheet
          open onClose={() => { setWithdrawOpen(false); setPrefillId(null) }}
          accounts={pockets} defaultAccountId={prefillId}
          onWithdraw={(id, amt, cur, notes) => withdrawFromSavings(id, amt, cur, notes)}
        />
      )}
      {updateAcc && (
        <UpdateBalanceSheet
          key={updateAcc.id} open onClose={() => setUpdateAcc(null)}
          account={updateAcc}
          onCorrect={(nb, notes) => correctSavingsBalance(updateAcc.id, nb, notes)}
        />
      )}
      {newAccountOpen && <AddSavingsAccountSheet open onClose={() => setNewAccountOpen(false)} />}
      {editAcc && (
        <EditSavingsAccountSheet open account={editAcc} onClose={() => setEditAcc(null)} />
      )}
    </div>
  )
}
