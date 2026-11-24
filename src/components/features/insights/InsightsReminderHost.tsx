'use client'

import { useEffect } from 'react'
import { useT } from '@/lib/i18n'
import { nextReminderAt, reminderDue, reminderObsolete } from '@/lib/insights/reminder'
import { useInsightsSignature } from '@/lib/insights/useInsightsDot'
import { isNative } from '@/lib/native/isNative'
import { attachInsightsReminderTap, cancelInsightsReminder, scheduleInsightsReminder } from '@/lib/native/insightsReminder'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/**
 * One evening reminder when Insights leads with findings the member has not seen: at most one a week, only where
 * notifications are already allowed, cancelled as soon as they open Insights. The findings are computed on the phone,
 * so this is a local notification, not a push.
 */
export function InsightsReminderHost() {
  const t = useT()
  const sig = useInsightsSignature()
  const seen = useSettingsStore((s) => s.insightsSeen)
  const remindedAt = useSettingsStore((s) => s.insightsRemindedAt)
  const title = t.insights.reminderTitle
  const body = t.insights.reminderBody

  useEffect(() => {
    if (isNative()) void attachInsightsReminderTap()
  }, [])

  useEffect(() => {
    if (!isNative()) return
    if (reminderObsolete(sig, seen)) {
      void cancelInsightsReminder()
      return
    }
    const now = Date.now()
    if (!reminderDue({ sig, seen, remindedAt, now })) return
    let live = true
    void scheduleInsightsReminder(title, body, nextReminderAt(new Date(now))).then((ok) => {
      if (ok && live) useSettingsStore.getState().setInsightsRemindedAt(now)
    })
    return () => { live = false }
  }, [sig, seen, remindedAt, title, body])

  return null
}
