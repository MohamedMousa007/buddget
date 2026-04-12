// Reserved for native push notifications integration
// Wire to FCM (Firebase Cloud Messaging) or web-push
// when deploying to Google Play via PWABuilder TWA wrapper
'use client'

import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { useT } from '@/lib/i18n'
import type { AppNotification } from '@/lib/notifications/useNotifications'

const SEVERITY_DOT: Record<AppNotification['severity'], string> = {
  critical: 'var(--color-brand-red)',
  warning: 'var(--color-brand-amber)',
  info: 'var(--color-brand-green)',
}

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
  notifications: AppNotification[]
  anchorRef: React.RefObject<HTMLElement | null>
}

export function NotificationPanel({ open, onClose, notifications, anchorRef }: NotificationPanelProps) {
  const t = useT()
  const { formatRelativeTime } = useLocalizedFormatters()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t)) return
      if (anchorRef.current?.contains(t)) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, onClose, anchorRef])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      className="absolute top-full end-0 z-50 mt-1.5 w-80 max-h-[400px] flex flex-col rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] shadow-xl ring-1 ring-[var(--color-brand-text-primary)]/5"
      role="dialog"
      aria-label={t.notifications.title}
    >
      <div className="shrink-0 border-b border-[var(--color-brand-border)] px-3 py-2.5">
        <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.notifications.title}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] text-[var(--color-brand-green)]">
              <Check className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <p className="text-sm text-[var(--color-brand-text-secondary)]">{t.notifications.emptyState}</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-brand-border)]">
            {notifications.map((n) => (
              <li key={n.id} className="px-3 py-3">
                <div className="flex gap-2.5">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: SEVERITY_DOT[n.severity] }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{n.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-brand-text-secondary)]">{n.body}</p>
                    <p className="mt-1 text-[10px] text-[var(--color-brand-text-muted)]">{formatRelativeTime(n.createdAt)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
