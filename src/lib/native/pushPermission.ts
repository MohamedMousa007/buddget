import { isNative } from '@/lib/native/isNative'
import type { OsPushPermission } from '@/lib/onboarding/pushPolicy'

/** The OS notification permission, read without asking. Anything unreadable counts as denied so nothing prompts by accident. */
export async function checkPushPermission(): Promise<OsPushPermission> {
  if (!isNative()) return 'denied'
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const { receive } = await PushNotifications.checkPermissions()
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt'
  } catch {
    return 'denied'
  }
}
