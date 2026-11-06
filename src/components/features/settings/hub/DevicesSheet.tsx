'use client'

import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { useCallback, useEffect, useState } from 'react'
import { MessageSquareText, Smartphone } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { useAuth } from '@/components/auth/auth-context'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useActionToast } from '@/components/ui/ActionToast'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { apiFetchAuth } from '@/lib/apiBase'
import {
  fetchDevices, hearsNotifications, makeDeviceMain, readCachedDevices, setDeviceNotify, writeCachedDevices,
  type DeviceRow, type DevicesPayload,
} from '@/lib/devices/notify'
import { STALE_MAIN_DAYS } from '@/lib/devices/policy'
import { useLocale } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

function useRelative() {
  const { locale } = useLocale()
  return (iso: string) => {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
    const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en', { numeric: 'auto' })
    if (minutes < 60) return rtf.format(-Math.max(minutes, 0), 'minute')
    if (minutes < 1440) return rtf.format(-Math.round(minutes / 60), 'hour')
    return rtf.format(-Math.round(minutes / 1440), 'day')
  }
}

/** Shows the last list this phone saw at once, then replaces it with the fresh one. */
function useDevicesList(open: boolean) {
  const userId = useAuth().user?.id ?? null
  const [data, setData] = useState<DevicesPayload | null>(() => readCachedDevices(userId))
  const [failed, setFailed] = useState(false)

  const apply = useCallback((next: DevicesPayload | null) => {
    if (next) {
      setData(next)
      setFailed(false)
      writeCachedDevices(userId, next)
    } else {
      setFailed(true)
    }
  }, [userId])

  const refresh = useCallback(async () => {
    const next = await fetchDevices()
    apply(next)
    return next
  }, [apply])

  useEffect(() => {
    if (open) void fetchDevices().then(apply)
  }, [open, apply])

  return { data, setData, failed, refresh }
}

const STALE_MS = STALE_MAIN_DAYS * 86_400_000

/** The phones on this account: which is main, who is told about things, what collects bank texts, and a way to remove a lost one. */
export function DevicesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const copy = useSettingsHubCopy()
  const d = copy.devices
  const relative = useRelative()
  const toast = useActionToast()
  const confirm = useConfirm()
  const { data, setData, failed, refresh } = useDevicesList(open)
  const [now] = useState(() => Date.now())
  const [pending, setPending] = useState<string | null>(null)

  const patchLocal = (fn: (list: DeviceRow[]) => DeviceRow[]) => setData((cur) => (cur ? { ...cur, devices: fn(cur.devices) } : cur))

  const setNotify = async (device: DeviceRow, on: boolean) => {
    const before = device.notify
    setPending(device.deviceId)
    patchLocal((list) => list.map((x) => (x.deviceId === device.deviceId ? { ...x, notify: on } : x)))
    const ok = await setDeviceNotify(device.deviceId, on)
    setPending(null)
    if (!ok) {
      patchLocal((list) => list.map((x) => (x.deviceId === device.deviceId ? { ...x, notify: before } : x)))
      toast(d.saveFailed)
    }
  }

  const makeMain = async (device: DeviceRow) => {
    const before = data?.devices ?? []
    setPending(device.deviceId)
    patchLocal((list) => list.map((x) => ({ ...x, isMain: x.deviceId === device.deviceId })))
    const ok = await makeDeviceMain(device.deviceId)
    setPending(null)
    if (!ok) {
      patchLocal(() => before)
      toast(d.saveFailed)
      return
    }
    await refresh()
  }

  const remove = async (device: DeviceRow) => {
    if (!(await confirm({ title: d.removeTitle(device.name), body: d.removeBody, confirmLabel: d.remove, destructive: true }))) return
    setPending(device.deviceId)
    let ok = false
    try {
      ok = (await apiFetchAuth(`/api/devices/${encodeURIComponent(device.deviceId)}`, { method: 'DELETE' })).ok
    } catch {
      ok = false
    }
    setPending(null)
    if (!ok) return toast(d.removeFailed)
    patchLocal((list) => list.filter((x) => x.deviceId !== device.deviceId))
    await refresh()
  }

  const thisId = data?.thisDeviceId ?? null
  const devices = data?.devices ?? []

  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName="z-[110]" panelClassName="md:w-[460px]" padContent>
      <div className="flex flex-col gap-4">
        <V3SheetHeader title={d.title} onClose={onClose} />
        {!data && !failed ? <SkeletonList rows={2} /> : null}
        {!data && failed ? (
          <EmptyState title={d.loadFailed} action={<Button variant="outline" size="touch" onClick={() => { void refresh() }}>{d.retry}</Button>} />
        ) : null}
        {data && devices.length === 0 ? <p className="py-6 text-center text-sm text-[var(--color-brand-text-muted)]">{d.empty}</p> : null}
        {data && failed ? <p className="text-xs text-[var(--color-brand-text-muted)]">{d.loadFailed}</p> : null}
        <ul className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto">
          {devices.map((device) => {
            const mine = device.deviceId === thisId
            const stale = now - Date.parse(device.lastSeenAt) > STALE_MS
            const blocked = device.pushPermission === 'denied'
            const busy = pending === device.deviceId
            return (
              <li key={device.deviceId} className="space-y-3 rounded-2xl border border-[var(--color-brand-border)] p-3">
                <div className="flex items-center gap-3">
                  <Smartphone className="size-5 shrink-0 text-[var(--color-brand-text-secondary)]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{device.name}</p>
                    <p className={stale ? 'text-xs text-[var(--color-brand-amber)]' : 'text-xs text-[var(--color-brand-text-muted)]'}>
                      {mine ? d.thisDevice : stale ? d.stale(relative(device.lastSeenAt)) : d.activeAgo(relative(device.lastSeenAt))}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {device.isMain ? <Badge variant="brand" size="xs">{d.mainBadge}</Badge> : null}
                    {mine ? <Badge variant="muted" size="xs">{d.thisDevice}</Badge> : null}
                  </div>
                </div>
                {device.collectsSms ? (
                  <p className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-[var(--color-brand-primary-ink)]">
                    <MessageSquareText className="size-4" aria-hidden />
                    {d.collecting} · {device.lastSmsAt ? d.lastText(relative(device.lastSmsAt)) : d.noTextYet}
                  </p>
                ) : null}
                <div className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl border border-[var(--color-brand-border)]">
                  <SettingsSwitchRow
                    label={d.notifyHere}
                    hint={busy ? d.pending : blocked ? d.blockedHere : device.isMain ? d.mainNote : d.notifyHint}
                    checked={hearsNotifications(device)}
                    disabled={blocked || busy}
                    onChange={(on) => { void setNotify(device, on) }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {!device.isMain && !blocked ? <Button variant="outline" size="touch" disabled={busy} onClick={() => { void makeMain(device) }}>{d.makeMain}</Button> : null}
                  {!mine ? <Button variant="outline" size="touch" disabled={busy} onClick={() => { void remove(device) }}>{d.remove}</Button> : null}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </ModalShell>
  )
}
