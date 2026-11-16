'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { writeOnboardingRecord } from '@/components/features/onboarding/useOnboarding'
import { useOnboardingCopy } from '@/components/features/onboarding/useOnboardingCopy'
import { notifyCheck } from '@/hooks/useNotifyDecision'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { reportThisDevice } from '@/lib/devices/notify'
import { createClient } from '@/lib/supabase/client'
import { registerPushNotifications } from '@/lib/native/pushNotifications'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/**
 * Asks, in the app's own words, before the OS permission dialog ever appears. One sheet, two steps: "allow reminders",
 * then, when another phone already gets them, "this phone too?" (it used to open a second dialog on top of this one).
 * `otherPhones` opens straight at the second step (a phone that already allows notifications, at boot).
 * "Not now" is remembered as `pushLaterAt` (same record the setup journey uses), so it is asked again only after a month.
 */
export function PushPrePromptSheet({ open, onClose, otherPhones = null }: { open: boolean; onClose: () => void; otherPhones?: string | null }) {
  const c = useOnboardingCopy().automate
  const d = useSettingsHubCopy().devices
  const language = useFinanceStore((s) => s.settings.language)
  const [busy, setBusy] = useState(false)
  // Set when "Allow" finds another phone; the boot path passes `otherPhones` instead.
  const [found, setNames] = useState<string | null>(null)
  const names = found ?? otherPhones

  /** An account that predates the setup journey has no record; `doneAt` keeps the journey from opening for it. */
  const remember = (patch: { push: 'allowed' | 'later'; pushLaterAt?: string }) => {
    const existing = useFinanceStore.getState().profile.financialProfile?.onboarding
    writeOnboardingRecord(existing ? patch : { ...patch, doneAt: new Date().toISOString() })
  }

  const finish = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
    } finally {
      setBusy(false)
      setNames(null)
      onClose()
    }
  }

  const register = async (explicit: boolean) => {
    const { data } = await createClient().auth.getSession()
    const session = data.session
    const granted = session
      ? await registerPushNotifications({ accessToken: session.access_token, userId: session.user.id, locale: language, notify: explicit ? true : undefined })
      : false
    remember(granted ? { push: 'allowed' } : { push: 'later', pushLaterAt: new Date().toISOString() })
  }

  const later = () => void finish(async () => remember({ push: 'later', pushLaterAt: new Date().toISOString() }))

  const keepQuiet = () =>
    void finish(async () => {
      useSettingsStore.getState().setPushOptOut(true)
      await reportThisDevice(false)
      remember({ push: 'later', pushLaterAt: new Date().toISOString() })
    })

  const allow = async () => {
    setBusy(true)
    const check = await notifyCheck()
    if (check.ask) {
      setNames(check.names)
      setBusy(false)
      return
    }
    await finish(() => register(check.explicit))
  }

  const step = names
    ? { title: d.alsoNotifyTitle, sub: d.alsoNotifyBody(names), yes: d.alsoNotifyYes, no: d.alsoNotifyNo, onYes: () => void finish(() => register(true)), onNo: keepQuiet }
    : { title: c.pushTitle, sub: c.pushSub, yes: c.pushAllow, no: c.notNow, onYes: () => void allow(), onNo: later }

  return (
    <ModalShell open={open} onBackdropClick={busy ? () => {} : step.onNo}>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={busy ? () => {} : step.onNo}>
          <V3SheetHeader.Title>{step.title}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{step.sub}</V3SheetHeader.Subtitle>
        </V3SheetHeader>
        <SheetFooter safeArea>
          <div className="flex flex-col gap-2">
            <Button size="cta-block" loading={busy} onClick={step.onYes} className="font-semibold">{step.yes}</Button>
            <Button variant="ghost" size="touch" className="w-full" disabled={busy} onClick={step.onNo}>{step.no}</Button>
          </div>
        </SheetFooter>
      </div>
    </ModalShell>
  )
}
