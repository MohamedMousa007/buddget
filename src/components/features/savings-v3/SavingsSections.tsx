'use client'

import type { ReactNode } from 'react'
import { ChevronRight, Landmark, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { GoalGlyph } from '@/components/features/goals/GoalGlyph'
import { GoalHomesLine } from '@/components/features/goals/GoalHomesLine'
import { PocketTile } from '@/components/features/savings-v3/MoneySheetParts'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
import type { GoalRow } from '@/hooks/useGoalRows'
import { useSavingsV9Copy } from '@/lib/i18n/savingsV9Copy'
import { useT } from '@/lib/i18n'
import { pocketDisplayName } from '@/lib/savings/pocketIdentity'
import { pocketHome } from '@/lib/savings/pocketHome'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import type { PaymentMethod, SavingsAccount } from '@/lib/store/types'
import { formatWhole } from '@/lib/utils/formatters'

const chev = <ChevronRight aria-hidden className="size-4 text-[var(--color-brand-text-muted)] rtl:rotate-180" />
const SEP = <div aria-hidden className="ms-[82px] h-px bg-[var(--color-brand-border)]" />

/** A v9 Savings section head: 17px title, its count, an optional quiet link on the end. */
export function SectionHead({ title, count, action }: { title: string; count?: number; action?: { label: string; onClick: () => void; add?: boolean } }) {
  return (
    <div className="mb-1 flex min-h-11 items-center gap-2 ps-1">
      <h2 className="text-[17px] font-bold text-[var(--color-brand-text-primary)]">{title}</h2>
      {count != null ? <span className="font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-text-muted)]">{count}</span> : null}
      {action ? (
        <Button variant="ghost" size="touch" onClick={action.onClick}
          className="ms-auto gap-1 px-1 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)] hover:text-[var(--color-brand-primary-ink)] [&_svg:not([class*='size-'])]:size-4">
          {action.add ? <Plus aria-hidden /> : null}{action.label}{action.add ? null : <ChevronRight aria-hidden className="rtl:rotate-180" />}
        </Button>
      ) : null}
    </div>
  )
}

function Section({ children }: { children: ReactNode }) {
  return <section className="px-4 lg:px-0">{children}</section>
}

export interface PocketItem {
  account: SavingsAccount
  /** In base; null when it could not be priced. */
  amount: number | null
}

/** Pockets (no target): each row says where its money is, set aside in an account or outside every account. */
export function PocketsSection({ pockets, methods, currency, onOpen, onAdd }: {
  pockets: PocketItem[]
  methods: readonly PaymentMethod[]
  currency: string
  onOpen: (account: SavingsAccount) => void
  onAdd: () => void
}) {
  const c = useSavingsV9Copy().page
  const sf = useT().savingsForms
  const hidden = useMask('lists')
  return (
    <Section>
      <SectionHead title={c.pockets} count={pockets.length} action={{ label: c.addPocket, onClick: onAdd, add: true }} />
      {pockets.length > 0 ? (
        <Card padding="none" className="overflow-hidden rounded-2xl">
          {pockets.map(({ account, amount }, i) => {
            const home = pocketHome(account, methods)
            const holder = home.kind === 'reserved' ? methods.find((m) => m.id === home.accountId) : undefined
            const foreign = account.currency !== currency
            return (
              <div key={account.id}>
                {i > 0 ? SEP : null}
                <TransactionRow
                  icon={<PocketTile account={account} className="size-10 rounded-[11px]" />}
                  iconBg="transparent"
                  title={pocketDisplayName(account, sf.systemNames)}
                  subtitle={holder ? c.inAccount(accountTitle(holder)) : c.outside}
                  amount={hidden ? MASK : foreign
                    ? <>{formatWhole(account.currentBalance)} <span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{account.currency === 'XAU' ? 'g' : account.currency}</span></>
                    : <>{formatWhole(amount ?? account.currentBalance)} <span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{currency}</span></>}
                  sub={!hidden && foreign && amount != null ? `≈ ${formatWhole(amount)} ${currency}` : undefined}
                  onClick={() => onOpen(account)}
                  dimmed={amount == null}
                />
              </div>
            )
          })}
        </Card>
      ) : null}
    </Section>
  )
}

/** Savings goals only, each with its progress and the places its money sits. */
export function GoalsSection({ rows, onOpen, onGoals }: { rows: GoalRow[]; onOpen: () => void; onGoals: () => void }) {
  const c = useSavingsV9Copy().page
  const hidden = useMask('lists')
  if (rows.length === 0) return null
  return (
    <Section>
      <SectionHead title={c.goals} count={rows.length} action={{ label: c.goalsLink, onClick: onGoals }} />
      <Card padding="none" className="overflow-hidden rounded-2xl">
        {rows.map((r, i) => (
          <div key={r.goal.id}>
            {i > 0 ? SEP : null}
            <TransactionRow
              icon={<GoalGlyph goal={r.goal} size={40} />}
              iconBg="transparent"
              title={r.goal.name}
              subtitle={
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="truncate">{c.goalOf(r.percent, hidden ? MASK : formatWhole(r.goal.targetAmount ?? 0))}</span>
                  <Progress value={Math.min(100, r.percent)} aria-hidden>
                    <ProgressTrack className="h-1 bg-[var(--color-brand-elevated)]">
                      <ProgressIndicator className="bg-[var(--color-brand-primary)]" />
                    </ProgressTrack>
                  </Progress>
                  <GoalHomesLine goal={r.goal} className="whitespace-normal font-sans" />
                </span>
              }
              amount={hidden ? MASK : formatWhole(r.current)}
              onClick={onOpen}
            />
          </div>
        ))}
      </Card>
      <p className="mt-2 px-1 text-xs leading-[1.45] text-[var(--color-brand-text-muted)]">{c.goalsNote}</p>
    </Section>
  )
}

/** One row for every savings account: they live in Accounts. */
export function SavingsAccountsSection({ count, total, currency, onOpen }: { count: number; total: number; currency: string; onOpen: () => void }) {
  const c = useSavingsV9Copy().page
  const hidden = useMask('lists')
  if (count === 0) return null
  return (
    <Section>
      <SectionHead title={c.savingsAccounts} />
      <Card padding="none" className="overflow-hidden rounded-2xl">
        <TransactionRow
          icon={<Landmark className="size-5" aria-hidden />}
          iconBg="color-mix(in oklab, var(--color-brand-primary) 16%, transparent)"
          iconFg="var(--color-brand-primary)"
          title={c.savingsAccountsRow(count)}
          subtitle={c.inAccountsPage}
          amount={<span className="inline-flex items-center gap-2">{hidden ? MASK : <>{formatWhole(total)} <span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{currency}</span></>}{chev}</span>}
          onClick={onOpen}
        />
      </Card>
    </Section>
  )
}
