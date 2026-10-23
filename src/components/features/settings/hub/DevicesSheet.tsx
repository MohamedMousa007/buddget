'use client'

import { SheetTitleBar } from './SheetTitleBar'
import { useCallback, useEffect, useState } from 'react'
import { MessageSquareText, Smartphone } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiFetchAuth } from '@/lib/apiBase'
import { useLocale } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { notifiesOnSms } from '@/lib/devices/policy'

interface Device { deviceId: string; name: string; platform: string; lastSeenAt: string; collectsSms: boolean; notifyOnSms: boolean | null; lastSmsAt: string | null }

async function fetchDevices(): Promise<{ thisDeviceId: string | null; devices: Device[] } | null> {
  try {
    const res = await apiFetchAuth('/api/devices')
    return res.ok ? ((await res.json()) as { thisDeviceId: string | null; devices: Device[] }) : null
  } catch {
    return null
  }
}

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

/** The phones on this account, which one collects bank texts and when it last did, and a way to remove a lost one. */
export function DevicesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const copy = useSettingsHubCopy()
  const d = copy.devices
  const relative = useRelative()
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [thisId, setThisId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const apply = useCallback((data: { thisDeviceId: string | null; devices: Device[] } | null) => {
    setThisId(data?.thisDeviceId ?? null)
    setDevices(data?.devices ?? [])
  }, [])

  useEffect(() => {
    if (open) void fetchDevices().then(apply)
  }, [open, apply])

  const setNotify = async (device: Device, on: boolean) => {
    setDevices((cur) => cur?.map((x) => (x.deviceId === device.deviceId ? { ...x, notifyOnSms: on } : x)) ?? cur)
    await apiFetchAuth(`/api/devices/${encodeURIComponent(device.deviceId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notifyOnSms: on }) })
  }
  const remove = async (device: Device) => {
    if (confirming !== device.deviceId) return setConfirming(device.deviceId)
    await apiFetchAuth(`/api/devices/${encodeURIComponent(device.deviceId)}`, { method: 'DELETE' })
    setConfirming(null)
    apply(await fetchDevices())
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName="z-[110]" panelClassName="md:w-[460px]" padContent>
      <div className="flex flex-col gap-4">
        <SheetTitleBar title={d.title} onClose={onClose} />
        {devices && devices.length === 0 ? <p className="py-6 text-center text-sm text-[var(--color-brand-text-muted)]">{d.empty}</p> : null}
        <ul className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto">
          {(devices ?? []).map((device) => {
            const mine = device.deviceId === thisId
            return (
              <li key={device.deviceId} className="space-y-3 rounded-2xl border border-[var(--color-brand-border)] p-3">
                <div className="flex items-center gap-3">
                  <Smartphone className="size-5 shrink-0 text-[var(--color-brand-text-secondary)]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{device.name}</p>
                    <p className="text-xs text-[var(--color-brand-text-muted)]">{mine ? d.thisDevice : d.activeAgo(relative(device.lastSeenAt))}</p>
                  </div>
                  {mine ? <Badge variant="muted" size="xs">{d.thisDevice}</Badge> : null}
                </div>
                {device.collectsSms ? (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-brand-primary-ink)]">
                      <MessageSquareText className="size-4" aria-hidden />
                      {d.collecting} · {device.lastSmsAt ? d.lastText(relative(device.lastSmsAt)) : d.noTextYet}
                    </p>
                    <div className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl border border-[var(--color-brand-border)]"><SettingsSwitchRow label={d.notifyHere} hint={d.notifyHint} checked={notifiesOnSms({ collects_sms: true, notify_on_sms: device.notifyOnSms })} onChange={(on) => { void setNotify(device, on) }} /></div>
                  </div>
                ) : null}
                {!mine ? (
                  <div>
                    <Button variant={confirming === device.deviceId ? 'destructive' : 'outline'} size="touch" onClick={() => { void remove(device) }}>
                      {confirming === device.deviceId ? d.confirmRemove : d.remove}
                    </Button>
                    {confirming === device.deviceId ? <p className="mt-1.5 text-xs text-[var(--color-brand-text-muted)]">{d.removeNote}</p> : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </ModalShell>
  )
}
