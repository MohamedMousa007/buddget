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
 * Before this phone asks the OS for notifications: if another phone already gets them, ask the user whether they really
 * want both. The main phone and an account with no other notifier are never asked. Unknown state (offline) proceeds as
 * it always did, so a failed lookup never blocks the prompt.
 */
export function useNotifyDecision() {
  const confirm = useConfirm()
  const d = useSettingsHubCopy().devices
  return useCallback(async (): Promise<NotifyDecision> => {
    if (!isNative()) return { proceed: true, explicit: false }
    const id = await getOrCreateDeviceId()
    const payload = id ? await fetchDevices() : null
    if (!payload || !id) return { proceed: true, explicit: false }
    const me = payload.devices.find((x) => x.deviceId === id)
    if (me?.isMain) return { proceed: true, explicit: false }
    const others = otherNotifiers(payload, id)
    if (others.length === 0) return { proceed: true, explicit: Boolean(me) }
    const ok = await confirm({
      title: d.alsoNotifyTitle,
      body: d.alsoNotifyBody(others.map((o) => o.name).join(', ')),
      confirmLabel: d.alsoNotifyYes,
      cancelLabel: d.alsoNotifyNo,
    })
    return ok ? { proceed: true, explicit: true } : { proceed: false, explicit: false }
  }, [confirm, d])
}
