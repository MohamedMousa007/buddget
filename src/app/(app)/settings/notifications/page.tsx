'use client'

import { NotificationsCard } from '@/components/features/settings/hub/NotificationsCard'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

/** Notifications: the master switch and the per-topic switches. */
export default function SettingsNotificationsPage() {
  const copy = useSettingsHubCopy()
  return <SettingsSubPageShell title={copy.page.notifications}><NotificationsCard /></SettingsSubPageShell>
}
