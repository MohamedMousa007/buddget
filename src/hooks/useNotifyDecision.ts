'use client'

import { useCallback } from 'react'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { fetchDevices, otherNotifiers } from '@/lib/devices/notify'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { getOrCreateDeviceId } from '@/lib/native/deviceId'
import { isNative } from '@/lib/native/isNative'

export interface NotifyDecision {
  /** Go ahead and ask the OS and register this phone. False when the user chose to keep it quiet. */
  proceed: boolean
  /** Record an explicit "notify here" for this phone: it is not the main phone, so it would stay silent otherwise. */
  explicit: boolean
}

/**
 * The lookup alone. `ask` names the other phones that already get notifications, so the caller asks the user; otherwise
 * go ahead. The main phone and an account with no other notifier are never asked. Unknown state (offline) goes ahead as
 * it always did, so a failed lookup never blocks the prompt.
 */
export async function notifyCheck(): Promise<{ ask: false; explicit: boolean } | { ask: true; names: string }> {
  if (!isNative()) return { ask: false, explicit: false }
  const id = await getOrCreateDeviceId()
  const payload = id ? await fetchDevices() : null
  if (!payload || !id) return { ask: false, explicit: false }
  const me = payload.devices.find((x) => x.deviceId === id)
  if (me?.isMain) return { ask: false, explicit: false }
  const others = otherNotifiers(payload, id)
  if (others.length === 0) return { ask: false, explicit: Boolean(me) }
  return { ask: true, names: others.map((o) => o.name).join(', ') }
}

/** Settings' switch: the same check, asked with the confirm dialog (nothing else is open there). */
export function useNotifyDecision() {
  const confirm = useConfirm()
  const d = useSettingsHubCopy().devices
  return useCallback(async (): Promise<NotifyDecision> => {
    const check = await notifyCheck()
    if (!check.ask) return { proceed: true, explicit: check.explicit }
    const ok = await confirm({
      title: d.alsoNotifyTitle,
      body: d.alsoNotifyBody(check.names),
      confirmLabel: d.alsoNotifyYes,
      cancelLabel: d.alsoNotifyNo,
    })
    return ok ? { proceed: true, explicit: true } : { proceed: false, explicit: false }
  }, [confirm, d])
}
