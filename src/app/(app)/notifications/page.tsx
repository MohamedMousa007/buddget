'use client'

import { PageBody } from '@/components/layout/PageContainer'
import { useCallback, useMemo, useState } from 'react'
import { Bell, MessageSquare, ShieldCheck, CheckCheck } from 'lucide-react'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { useNotifications } from '@/hooks/useNotifications'
import { useSmsTracking } from '@/hooks/useSmsTracking'
import { useT } from '@/lib/i18n'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatTile } from '@/components/ui/StatTile'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { NeedsYouList } from '@/components/notifications/NeedsYouList'
import { usePendingEntries } from '@/lib/alerts/usePending'
import { cn } from '@/lib/utils'

const SEVERITY_DOT: Record<'warning' | 'info' | 'critical', string> = {
  critical: 'var(--color-brand-red)',
  warning: 'var(--color-brand-amber)',
  info: 'var(--color-brand-green)',
}

/**
 * Web-only notification center (reached from the profile menu). Native devices
 * use the OS notification tray instead. Merges server rows (SMS + cron alerts)
 * with the client-computed status alerts, and surfaces SMS-tracking status.
 */
export default function NotificationsPage() {
  const t = useT()
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const localized = useLocalizedFormatters()
  const formatRelativeTime = useCallback((iso: string) => {
    try { return localized.formatRelativeTime(iso) } catch { return '' }
  }, [localized])
  const { isEnabled, lastReceivedAt } = useSmsTracking()
  // Opens on what needs the user when something does, otherwise on the feed; the user's own pick wins after that.
  const pending = usePendingEntries()
  const [picked, setPicked] = useState<'needs-you' | 'updates' | null>(null)
  const tab = picked ?? (pending.length > 0 ? 'needs-you' : 'updates')

  const smsStatus = useMemo(() => {
    if (!isEnabled) return null
    if (lastReceivedAt) {
      const rel = formatRelativeTime(lastReceivedAt)
      return { connected: true, label: t.smsTracking.iosStatusConnected(rel) }
    }
    return { connected: false, label: t.smsTracking.iosStatusWaiting }
  }, [isEnabled, lastReceivedAt, t, formatRelativeTime])

  const smsCard = (className?: string) =>
    smsStatus ? (
      <Card
        padding="none"
        className={cn(
          'flex items-center gap-2.5 px-4 py-3',
          smsStatus.connected ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-text-muted)]',
          className,
        )}
      >
        {smsStatus.connected ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <MessageSquare className="h-4 w-4 shrink-0" />}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--color-brand-text-primary)]">{t.smsTracking.sectionTitle}</p>
          <p className="text-xs text-[var(--color-brand-text-secondary)] truncate">{smsStatus.label}</p>
        </div>
      </Card>
    ) : null

  return (
    <div>
      <PageBody narrow className="flex flex-col gap-4 lg:max-w-[var(--page-max-wide)] animate-[dashboardIn_0.35s_ease-out] lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-6">
        <div className="flex items-center justify-between lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl flex items-center justify-center bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary-ink)]">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-base lg:text-xl font-semibold text-[var(--color-brand-text-primary)]">
                {t.notifications.title}
              </h1>
              {unreadCount > 0 ? (
                <p className="text-xs text-[var(--color-brand-text-muted)]">{unreadCount}</p>
              ) : null}
            </div>
          </div>
          {notifications.length > 0 ? (
            <Button
              onClick={() => void markAllRead()}
              variant="link"
              size="xs"
              className="text-[var(--color-brand-primary-ink)] no-underline hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t.notifications.markAllRead}
            </Button>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
        <SegmentedControl
          ariaLabel={t.notifications.tabsLabel}
          value={tab}
          onChange={setPicked}
          options={[
            { value: 'needs-you', label: t.notifications.needsYouTab, count: pending.length },
            { value: 'updates', label: t.notifications.updatesTab },
          ]}
        />
        {tab === 'needs-you' ? (
          <NeedsYouList />
        ) : (
        <>
        {smsCard('lg:hidden')}

        {notifications.length > 0 ? (
          <Card render={<ul />} padding="none" divide>
            {notifications.map((n) => (
              <li key={n.id} className="flex gap-3 px-4 py-3.5">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: SEVERITY_DOT[n.severity] }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--color-brand-text-primary)] truncate">{n.title}</p>
                    <span className="shrink-0 text-[0.625rem] text-[var(--color-brand-text-muted)]">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-brand-text-secondary)]">{n.body}</p>
                </div>
              </li>
            ))}
          </Card>
        ) : (
          <Card padding="none" className="py-14 text-center">
            <Bell className="mx-auto h-7 w-7 text-[var(--color-brand-text-muted)]" />
            <p className="mt-3 text-sm text-[var(--color-brand-text-secondary)]">{t.notifications.emptyState}</p>
          </Card>
        )}
        </>
        )}
        </div>
        <aside className="hidden flex-col gap-4 lg:flex">
          <div className="grid grid-cols-2 gap-2">
            <StatTile compact label={t.notifications.unreadLabel} value={unreadCount} tone={unreadCount > 0 ? 'brand' : 'default'} />
            <StatTile compact label={t.notifications.totalLabel} value={notifications.length} />
          </div>
          {smsCard()}
        </aside>
      </PageBody>
    </div>
  )
}
