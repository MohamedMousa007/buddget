'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/useNotifications'
import { useActionToast } from '@/components/ui/ActionToast'
import { useT } from '@/lib/i18n'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/button'
import {
  confirmRecurringDebtPayment,
  snoozeRecurringDebtPayment,
} from '@/lib/debts/recurringDebtDueHandlers'

const SEVERITY_DOT: Record<'warning' | 'info' | 'critical', string> = {
  critical: 'var(--color-brand-red)',
  warning: 'var(--color-brand-amber)',
  info: 'var(--color-brand-green)',
}

export type NotificationInboxVariant = 'default' | 'dark'

/**
 * Bell + dropdown: local nudges. `variant="dark"` re-paints just the trigger
 * button so it sits naturally on a dark hero; the dropdown panel keeps its
 * normal light styling so it reads as a light card popping out of the dark
 * surface. All other call sites keep the default light trigger.
 */
export function NotificationInbox({
  className,
  variant = 'default',
}: {
  className?: string
  variant?: NotificationInboxVariant
}) {
  const t = useT()
  const wrapRef = useRef<HTMLDivElement>(null)
  const toast = useActionToast()
  const [open, setOpen] = useState(false)
  const [paidIds, setPaidIds] = useState<ReadonlySet<string>>(new Set())
  const {
    notifications,
    unreadCount,
    markAllRead,
  } = useNotifications()

  const confirmPaid = (notificationId: string, recurringId: string) => {
    const ok = confirmRecurringDebtPayment(recurringId)
    if (ok) setPaidIds((prev) => new Set(prev).add(notificationId))
    toast(ok ? t.moneyFlows.markedPaid : t.moneyFlows.paidFailed)
  }

  const visible = notifications.filter((n) => !paidIds.has(n.id))

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
      <IconButton
        onClick={() => setOpen((v) => !v)}
        variant={variant === 'dark' ? 'onBrand' : 'outlined'}
        size="sm"
        className={cn(variant === 'dark' && 'border-white/15')}
        aria-label={t.notifications.title}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -end-1 min-w-5 h-5 rounded-full bg-[var(--color-brand-primary)] px-1 text-[10px] font-bold leading-[18px] text-center text-[var(--color-brand-on-primary)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </IconButton>

      {open ? (
        <div
          className="absolute top-full end-0 z-50 mt-1.5 w-80 max-h-[min(420px,70vh)] overflow-y-auto rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] shadow-xl ring-1 ring-[var(--color-brand-text-primary)]/5"
          role="dialog"
          aria-label={t.notifications.title}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-2.5">
            <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.notifications.title}</p>
            <Button variant="link" size="xs" onClick={() => void markAllRead()} className="no-underline hover:underline">
              {t.notifications.markAllRead}
            </Button>
          </div>
          <div className="px-3 py-3 space-y-3">
            {visible.length > 0 ? (
              <ul className="divide-y divide-[var(--color-brand-border)]">
                {visible.map((n) => (
                  <li key={n.id} className="py-3">
                    <div className="flex gap-2.5">
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: SEVERITY_DOT[n.severity] }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{n.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-brand-text-secondary)]">{n.body}</p>
                        {n.type === 'recurring_due' && n.recurringId ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              variant="ghost"
                              size="touch"
                              onClick={() => confirmPaid(n.id, n.recurringId!)}
                              className="bg-[var(--color-brand-green)]/20 text-[var(--color-brand-green)] hover:bg-[var(--color-brand-green)]/30"
                            >
                              {t.notifications.recurringConfirmPaid}
                            </Button>
                            <Button
                              variant="outline"
                              size="touch"
                              onClick={() => snoozeRecurringDebtPayment(n.recurringId!)}
                            >
                              {t.notifications.recurringSnooze}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {visible.length === 0 ? (
              <p className="text-sm text-[var(--color-brand-text-secondary)] text-center py-8">{t.notifications.emptyState}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
