'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/useNotifications'
import { BudgetInviteCard } from '@/components/notifications/BudgetInviteCard'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'

const SEVERITY_DOT: Record<'warning' | 'info' | 'critical', string> = {
  critical: '#E50914',
  warning: '#FF9F0A',
  info: '#1DB954',
}

/**
 * Bell + dropdown: local nudges + server budget invites (invite card actions).
 */
export function NotificationInbox({ className }: { className?: string }) {
  const t = useT()
  const router = useRouter()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const {
    notifications,
    serverNotifications,
    unreadCount,
    markAllRead,
    refetchServerNotifications,
  } = useNotifications()
  const setActiveSharedBudgetId = useFinanceStore((s) => s.setActiveSharedBudgetId)

  const inviteRows = serverNotifications.filter((n) => n.type === 'budget_invite' && !n.read)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative cursor-pointer inline-flex items-center justify-center rounded-lg border border-[var(--color-brand-border)] p-2 text-white hover:bg-[var(--color-brand-elevated)]"
        aria-label={t.notifications.title}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] rounded-full bg-[var(--color-brand-red)] px-1 text-[10px] font-bold leading-[18px] text-center text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute top-full end-0 z-50 mt-1.5 w-80 max-h-[min(420px,70vh)] overflow-y-auto rounded-2xl border border-[#2A2A38] bg-[#111118] shadow-xl ring-1 ring-white/5"
          role="dialog"
          aria-label={t.notifications.title}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#2A2A38] bg-[#111118] px-3 py-2.5">
            <p className="text-sm font-semibold text-white">{t.notifications.title}</p>
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="cursor-pointer text-xs text-[var(--color-brand-red)] hover:underline"
            >
              {t.notifications.markAllRead}
            </button>
          </div>
          <div className="px-3 py-3 space-y-3">
            {inviteRows.map((row) => (
              <BudgetInviteCard
                key={row.id}
                row={row}
                labels={{
                  preview: t.sharedBudget.previewPlan,
                  accept: t.sharedBudget.accept,
                  decline: t.sharedBudget.decline,
                  working: t.common.loading,
                }}
                onPreview={(planId) => {
                  setActiveSharedBudgetId(planId)
                  setOpen(false)
                  router.push('/budget-setup')
                }}
                onResolved={() => void refetchServerNotifications()}
              />
            ))}
            {notifications.length > 0 ? (
              <ul className="divide-y divide-[#2A2A38]">
                {notifications.map((n) => (
                  <li key={n.id} className="py-3">
                    <div className="flex gap-2.5">
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: SEVERITY_DOT[n.severity] }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">{n.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[#A0A0B8]">{n.body}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {notifications.length === 0 && inviteRows.length === 0 ? (
              <p className="text-sm text-[#A0A0B8] text-center py-8">{t.notifications.emptyState}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
