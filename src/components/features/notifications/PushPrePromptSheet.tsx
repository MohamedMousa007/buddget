'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { writeOnboardingRecord } from '@/components/features/onboarding/useOnboarding'
import { useOnboardingCopy } from '@/components/features/onboarding/useOnboardingCopy'
import { useNotifyDecision } from '@/hooks/useNotifyDecision'
import { reportThisDevice } from '@/lib/devices/notify'
import { createClient } from '@/lib/supabase/client'
import { registerPushNotifications } from '@/lib/native/pushNotifications'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'

/**
 * Asks, in the app's own words, before the OS permission dialog ever appears. Allow starts the OS request; "Not now" is
 * remembered as `pushLaterAt` (same record the setup journey uses), so it is asked again only after a month.
 * Reuses ModalShell, Button and the setup journey's reminder copy.
 */
export function PushPrePromptSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useOnboardingCopy().automate
  const decide = useNotifyDecision()
  const language = useFinanceStore((s) => s.settings.language)
  const [busy, setBusy] = useState(false)

  /** An account that predates the setup journey has no record; `doneAt` keeps the journey from opening for it. */
  const remember = (patch: { push: 'allowed' | 'later'; pushLaterAt?: string }) => {
    const existing = useFinanceStore.getState().profile.financialProfile?.onboarding
    writeOnboardingRecord(existing ? patch : { ...patch, doneAt: new Date().toISOString() })
  }

  const later = () => {
    remember({ push: 'later', pushLaterAt: new Date().toISOString() })
    onClose()
  }

  const allow = async () => {
    setBusy(true)
    try {
      const decision = await decide()
      if (!decision.proceed) {
        useSettingsStore.getState().setPushOptOut(true)
        await reportThisDevice(false)
        remember({ push: 'later', pushLaterAt: new Date().toISOString() })
        return
      }
      const { data } = await createClient().auth.getSession()
      const session = data.session
      const granted = session
        ? await registerPushNotifications({ accessToken: session.access_token, userId: session.user.id, locale: language, notify: decision.explicit ? true : undefined })
        : false
      remember(granted ? { push: 'allowed' } : { push: 'later', pushLaterAt: new Date().toISOString() })
    } finally {
      setBusy(false)
      onClose()
    }
  }

  return (
    <ModalShell open={open} onBackdropClick={later} padContent>
      <div className="flex flex-col gap-3 pt-1">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-cat-4)] text-white"><Bell className="size-5" aria-hidden /></span>
        <V3SheetHeader.DialogTitle align="start">{c.pushTitle}</V3SheetHeader.DialogTitle>
        <p className="text-[0.90625rem] leading-snug text-[var(--color-brand-text-secondary)]">{c.pushSub}</p>
        <Button size="cta" className="w-full" loading={busy} onClick={() => void allow()}>{c.pushAllow}</Button>
        <Button variant="ghost" size="touch" className="w-full" disabled={busy} onClick={later}>{c.notNow}</Button>
      </div>
    </ModalShell>
  )
}
