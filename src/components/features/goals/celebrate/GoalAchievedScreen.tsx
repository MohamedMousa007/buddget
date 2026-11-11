'use client'

import { useRef, useState } from 'react'
import { Share2, Trophy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { useGoalAllocationRuns } from '@/hooks/useGoalAllocationRuns'
import { useT } from '@/lib/i18n'
import { useDismissable } from '@/hooks/useDismissable'
import { useDialogFocus } from '@/hooks/useDialogFocus'
import { navigate } from '@/lib/navigation/navigate'
import { getGoalStatus } from '@/lib/goals/goalStatus'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Goal } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'

const CONFETTI = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i % 8) * 0.35}s`,
  color: ['var(--color-brand-on-primary)', 'var(--color-brand-primary-bright)', 'var(--color-brand-amber)', 'var(--color-brand-primary-soft)'][i % 4],
}))

/** Full-screen "goal achieved": brand teal, white disc with a teal trophy, confetti (static when motion is reduced). */
export function GoalAchievedScreen({ goal, current, onClose }: { goal: Goal; current: number; onClose: () => void }) {
  const t = useT().goals.celebrate
  useDismissable(true, onClose)
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogFocus(true, panelRef)
  const runs = useGoalAllocationRuns()[goal.id] ?? []
  const deposits = useFinanceStore((s) =>
    s.savingsTransactions.filter((x) => goal.linkedSavingsAccountIds.includes(x.accountId) && x.type === 'deposit').length,
  )
  const [now] = useState(() => new Date())
  const months = Math.max(1, Math.round((now.getTime() - new Date(goal.createdAt).getTime()) / (30.4 * 86_400_000)))
  const streak = getGoalStatus({ goal: { ...goal, status: 'active', fundingMode: goal.fundingMode === 'manual' ? 'fixed' : goal.fundingMode }, current: 0, runs, now })
  const streakCount = streak.kind === 'streak' ? (streak.params.count ?? 0) : 0
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const tiles: [string, number][] = [[t.statMonths, months], [t.statDeposits, deposits], [t.statStreak, streakCount]]
  const go = (path: string) => {
    onClose()
    navigate(path)
  }

  return (
    <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t.youDidIt} className="outline-none fixed inset-0 z-[var(--z-dialog)] flex flex-col items-center overflow-y-auto bg-[var(--color-brand-primary)] px-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-[calc(3rem+env(safe-area-inset-top,0px))] text-center text-[var(--color-brand-on-primary)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {CONFETTI.map((c, i) => (
          <span key={i} className="goal-confetti absolute top-0 h-2.5 w-1.5 rounded-sm" style={{ left: c.left, animationDelay: c.delay, background: c.color }} />
        ))}
      </div>
      <IconButton aria-label={t.close} onClick={onClose} className="absolute end-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] text-[var(--color-brand-on-primary)] hover:bg-[var(--color-brand-on-primary)]/15">
        <X />
      </IconButton>
      <div className="relative mt-4 flex size-28 items-center justify-center">
        <span className="goal-pulse absolute inset-0 rounded-full border-2 border-[var(--color-brand-on-primary)]" aria-hidden />
        <span className="goal-pulse absolute inset-0 rounded-full border-2 border-[var(--color-brand-on-primary)]" style={{ animationDelay: '1.1s' }} aria-hidden />
        <span className="relative flex size-24 items-center justify-center rounded-full bg-[var(--color-brand-on-primary)]">
          <Trophy className="size-12 text-[var(--color-brand-primary)]" aria-hidden />
        </span>
      </div>
      <p className="mt-6 text-[0.8125rem] font-bold tracking-[0.12em]">{t.kicker}</p>
      <h2 className="mt-1 text-[38px] font-bold leading-tight">{t.youDidIt}</h2>
      <p className="mt-2 max-w-xs text-sm opacity-90">{t.summary(goal.name, months)}</p>
      <p className="mt-4 font-mono-numbers text-4xl font-bold">{formatCurrency(current, goal.currency, false)}</p>
      <div className="mt-6 grid w-full max-w-sm grid-cols-3 gap-2">
        {tiles.map(([label, v]) => (
          <div key={label} className="rounded-[14px] bg-[var(--color-brand-on-primary)]/15 px-2 py-3">
            <p className="font-mono-numbers text-xl font-bold">{v}</p>
            <p className="text-[0.6875rem] font-semibold opacity-90">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid w-full max-w-sm grid-cols-4 gap-1.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1.5 rounded-full bg-[var(--color-brand-on-primary)]" />
        ))}
      </div>
      <div className="mt-8 flex w-full max-w-sm flex-col gap-2.5">
        <Button size="cta-block" onClick={() => go('/goals')} className="bg-[var(--color-brand-on-primary)] text-[var(--color-brand-primary-ink)] hover:bg-[var(--color-brand-on-primary)]/90">
          {t.setNext}
        </Button>
        <div className="flex gap-2.5">
          {canShare ? (
            <Button size="touch" variant="ghost" className="flex-1 text-[var(--color-brand-on-primary)] hover:bg-[var(--color-brand-on-primary)]/15" onClick={() => void navigator.share({ text: t.shareText(goal.name) }).catch(() => {})}>
              <Share2 aria-hidden />
              {t.share}
            </Button>
          ) : null}
          <Button size="touch" variant="ghost" onClick={() => go('/wealth')} className="flex-1 text-[var(--color-brand-on-primary)] hover:bg-[var(--color-brand-on-primary)]/15">
            {t.moveToWealth}
          </Button>
        </div>
      </div>
    </div>
  )
}
