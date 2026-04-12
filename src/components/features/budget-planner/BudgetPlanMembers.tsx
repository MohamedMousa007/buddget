'use client'

import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth/AuthProvider'
import { useT } from '@/lib/i18n'

type MemberRow = {
  id: string
  user_id: string | null
  invited_email: string | null
  role: string
  status: string
  sync_transactions: boolean
}

export interface BudgetPlanMembersProps {
  planId: string
  isOwner: boolean
  onOpenInvite: () => void
  onSetDefault: () => void | Promise<void>
  showSetDefault: boolean
}

/**
 * Lists members for a shared budget plan and opens the invite sheet.
 */
export function BudgetPlanMembers({
  planId,
  isOwner,
  onOpenInvite,
  onSetDefault,
  showSetDefault,
}: BudgetPlanMembersProps) {
  const t = useT()
  const { user } = useAuth()
  const [rows, setRows] = useState<MemberRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    void (async () => {
      const { data, error } = await supabase
        .from('shared_budget_members')
        .select('id, user_id, invited_email, role, status, sync_transactions')
        .eq('plan_id', planId)
        .order('invited_at', { ascending: true })
      if (cancelled) return
      if (error) {
        setError(error.message)
        return
      }
      setRows((data ?? []) as MemberRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [planId])

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-5 w-5 text-[var(--color-brand-red)]" />
        <h2 className="text-base font-semibold text-[var(--color-brand-text-primary)]">{t.sharedBudget.membersTitle}</h2>
      </div>
      {error ?
        <p className="text-xs text-amber-200/90 mb-2">{error}</p>
      : null}
      <ul className="space-y-2 mb-4">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-2 text-sm text-[var(--color-brand-text-muted)]"
          >
            <span className="text-[var(--color-brand-text-primary)]">
              {r.user_id === user?.id ?
                `${t.sharedBudget.you}`
              : r.invited_email ?
                r.invited_email
              : '…'}
            </span>
            <span className="text-xs capitalize">
              {r.role === 'owner' ? t.sharedBudget.roleOwner : r.role === 'manager' ? t.sharedBudget.roleManager : t.sharedBudget.roleViewer}
              {r.sync_transactions ? ` · ${t.sharedBudget.syncOn}` : ''}
            </span>
          </li>
        ))}
      </ul>
      {showSetDefault ?
        <button
          type="button"
          onClick={() => void onSetDefault()}
          className="mb-3 w-full cursor-pointer rounded-lg border border-[var(--color-brand-border)] py-2 text-xs font-medium text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-card)]"
        >
          {t.sharedBudget.setAsDefaultPlan}
        </button>
      : null}
      {isOwner ?
        <button
          type="button"
          onClick={onOpenInvite}
          className="w-full cursor-pointer rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] py-3 text-sm font-semibold text-white"
        >
          {t.sharedBudget.addPartner}
        </button>
      : null}
    </section>
  )
}
