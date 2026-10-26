'use client'

import { useCallback, useEffect, useState } from 'react'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { SettingsToggleRow } from '@/components/features/settings/SettingsToggleRow'
import { GROUP_TONE } from '@/components/features/settings/groupMeta'
import { useActionToast } from '@/components/ui/ActionToast'
import { useNotifyDecision } from '@/hooks/useNotifyDecision'
import { usePushPermission } from '@/hooks/usePushPermission'
import { reportThisDevice } from '@/lib/devices/notify'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { isNative } from '@/lib/native/isNative'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { cn } from '@/lib/utils'

/** Asks the OS (or browser) for permission; true when notifications may be shown afterwards. */
async function askPermission(): Promise<boolean> {
  if (isNative()) {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const { receive } = await PushNotifications.requestPermissions()
    return receive === 'granted'
  }
  if (typeof Notification === 'undefined') return false
  return (await Notification.requestPermission()) === 'granted'
}

/** Notifications as an ordinary switch, with the per-topic switches under it. Off means Buddget stops sending. */
export function NotificationsCard() {
  const copy = useSettingsHubCopy()
  const n = copy.notif
  const permission = usePushPermission()
  const decide = useNotifyDecision()
  const toast = useActionToast()
  const language = useFinanceStore((s) => s.settings.language)
  const optOut = useSettingsStore((s) => s.pushOptOut)
  const setOptOut = useSettingsStore((s) => s.setPushOptOut)
  const [granted, setGranted] = useState<boolean | null>(null)
  useEffect(() => {
    if (permission === 'allowed') setGranted(true)
    else if (permission === 'blocked' || permission === 'notAsked') setGranted(false)
  }, [permission])

  const on = granted === true && !optOut
  const blocked = permission === 'blocked' && granted !== true
  const unsupported = permission === 'unsupported'

  const change = useCallback(
    async (next: boolean) => {
      if (!next) {
        setOptOut(true)
        if (isNative()) {
          const { createClient } = await import('@/lib/supabase/client')
          const { unregisterPushToken } = await import('@/lib/native/pushNotifications')
          const { data } = await createClient().auth.getSession()
          if (data.session) await unregisterPushToken(data.session.access_token)
          await reportThisDevice(false)
        }
        return
      }
      const decision = await decide()
      if (!decision.proceed) {
        setOptOut(true)
        await reportThisDevice(false)
        toast(copy.devices.keptQuiet)
        return
      }
      if (isNative()) {
        const { createClient } = await import('@/lib/supabase/client')
        const { registerPushNotifications } = await import('@/lib/native/pushNotifications')
        const { data } = await createClient().auth.getSession()
        const session = data.session
        const ok = session ? await registerPushNotifications({ accessToken: session.access_token, userId: session.user.id, locale: language, notify: decision.explicit ? true : undefined }) : false
        setGranted(ok)
        if (ok) {
          setOptOut(false)
          if (!decision.explicit) await reportThisDevice(null)
        }
        return
      }
      const ok = granted === true || (await askPermission())
      setGranted(ok)
      if (ok) setOptOut(false)
    },
    [granted, setOptOut, decide, toast, copy.devices.keptQuiet, language],
  )

  const status = unsupported ? n.unsupported : blocked ? n.blocked : on ? n.on : n.off

  return (
    <div className="space-y-3">
      <SettingsSection title={n.title}>
        <SettingsSwitchRow id="pushStatus" label={n.master} tone={GROUP_TONE.notifications} hint={status} checked={on} onChange={(v) => void change(v)} disabled={unsupported || blocked} />
        {blocked ? <p className="px-4 py-3 text-xs text-[var(--color-brand-text-muted)]">{n.pushHint}</p> : null}
        <div className={cn('divide-y divide-[var(--color-brand-border)]', !on && 'opacity-50')}>
          <SettingsToggleRow id="subDueReminders" tone={GROUP_TONE.notifications} hint={n.dueHint} disabled={!on} />
          <SettingsToggleRow id="subPriceAlerts" tone={GROUP_TONE.notifications} hint={n.priceHint} disabled={!on} />
          <SettingsToggleRow id="goalProgressAlerts" tone={GROUP_TONE.notifications} hint={n.progressHint} disabled={!on} />
          <SettingsToggleRow id="goalAlerts" tone={GROUP_TONE.notifications} hint={n.behindHint} disabled={!on} />
        </div>
      </SettingsSection>
    </div>
  )
}
