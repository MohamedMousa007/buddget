import { REMINDER_ID } from '@/lib/insights/reminder'
import { isNative } from '@/lib/native/isNative'

let tapAttached = false

/**
 * Schedules the one Insights reminder. It only checks the notification permission, never asks for it: a reminder the
 * member has not allowed is simply not sent. Resolves true when it is scheduled.
 */
export async function scheduleInsightsReminder(title: string, body: string, at: Date): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return false
    await LocalNotifications.schedule({ notifications: [{ id: REMINDER_ID, title, body, schedule: { at } }] })
    return true
  } catch (e) {
    console.error('[insights] reminder not scheduled', e)
    return false
  }
}

/** Removes the pending reminder, if there is one. */
export async function cancelInsightsReminder(): Promise<void> {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] })
  } catch {
    // nothing pending, or the plugin is unavailable: nothing to undo
  }
}

/** Opens Insights when the member taps the reminder. Attached once; a cold start from the tap is delivered after it. */
export async function attachInsightsReminderTap(): Promise<void> {
  if (!isNative() || tapAttached) return
  tapAttached = true
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const { navigate } = await import('@/lib/navigation/navigate')
    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      if (action.notification.id === REMINDER_ID) navigate('/reports')
    })
  } catch {
    tapAttached = false
  }
}
