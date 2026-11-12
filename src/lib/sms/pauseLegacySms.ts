import type { ServiceClient } from '@/lib/supabase/service'
import { emitNotification } from '@/lib/server/emitNotification'

const COPY = {
  en: { title: 'SMS tracking is paused', body: 'For your security, SMS tracking was switched off on an older version of Buddget. Update the app, then turn it on again in Settings.' },
  ar: { title: 'تم إيقاف تتبع الرسائل مؤقتًا', body: 'لحماية حسابك، تم إيقاف تتبع الرسائل على نسخة أقدم من بادجت. حدّث التطبيق ثم فعّله من جديد من الإعدادات.' },
} as const

/**
 * An installed build that sends no device header can no longer prove which phone it is. Instead of leaving it half-working,
 * switch SMS tracking off for the account (intent), retire its device-less ingest tokens, and ask once, in the app, to turn it
 * back on after updating: the new build reads the off intent, then Settings mints a device-scoped token.
 */
export async function pauseSmsForLegacyBuild(service: ServiceClient, userId: string): Promise<void> {
  const { data: settings } = await service.from('user_settings').select('language').eq('user_id', userId).maybeSingle()
  const copy = COPY[settings?.language === 'ar' ? 'ar' : 'en']
  const { created } = await emitNotification(service, {
    userId,
    category: 'sms_paused_update',
    severity: 'warning',
    dedupeKey: 'sms-paused-legacy-build',
    title: copy.title,
    body: copy.body,
    push: false,
  })
  if (!created) return
  await service.from('user_settings').update({ sms_tracking_enabled: false }).eq('user_id', userId)
  await service.from('sms_ingest_tokens').update({ is_active: false }).eq('user_id', userId).is('device_id', null)
}
