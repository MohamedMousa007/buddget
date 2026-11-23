'use client'

import { useState } from 'react'
import { ArrowDown, Bell, Check, MessageSquare, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useSmsTracking } from '@/hooks/useSmsTracking'
import { createClient } from '@/lib/supabase/client'
import { isIOS } from '@/lib/native/isNative'
import { guideVariantFor, useIosMajor } from '@/lib/native/iosVersion'
import { SmsBrandIntro } from '@/components/onboarding/sms/SmsBrandIntro'
import { SmsSetupGuide, SmsSetupScreen } from '@/components/onboarding/sms/SmsSetupGuide'
import { registerPushNotifications } from '@/lib/native/pushNotifications'
import { trackOnboarding } from '@/lib/onboarding/track'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { stepLead, stepTitle } from './BuddgyHead'
import type { StepChrome } from './chrome'
import { JourneyFrame } from './JourneyFrame'
import { useOnboarding } from './useOnboarding'
import { useOnboardingCopy } from './useOnboardingCopy'

type Sheet = 'android' | 'ios' | null

/** Step 5 (apps only): bank-text capture and reminders, each shown working before it asks for anything. */
export function StepAutomate({ chrome }: { chrome: StepChrome }) {
  const c = useOnboardingCopy()
  const sms = useSmsTracking({ withDeviceSms: true })
  const guide = useT().smsTracking.guide
  const setupCopy = useT().smsSetup
  const iosMajor = useIosMajor()
  // iPhone: the same facts as Settings (BDG-008). Armed but no SMS from this phone yet is "Not confirmed yet", not done.
  const smsDone = isIOS() ? sms.isEnabled && sms.setup.verified : sms.isEnabled
  const smsUnconfirmed = isIOS() && sms.isEnabled && !sms.setup.verified
  const { record, patch } = useOnboarding()
  const language = useFinanceStore((s) => s.settings.language)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [pushBusy, setPushBusy] = useState(false)

  const askSms = () => setSheet(isIOS() ? 'ios' : 'android')

  const allowSms = async () => {
    setSheet(null)
    await sms.toggle(true)
    // toggle() returns nothing and quietly stays off on a denial or a failed token fetch; the setting is the outcome.
    trackOnboarding('onboarding_permission', { kind: 'sms', granted: useFinanceStore.getState().settings.smsTrackingEnabled })
  }

  const allowPush = async () => {
    setPushBusy(true)
    const { data } = await createClient().auth.getSession()
    const token = data.session?.access_token
    const userId = data.session?.user?.id
    const granted = token && userId ? await registerPushNotifications({ accessToken: token, userId, locale: language }) : false
    patch(granted ? { push: 'allowed' } : { push: 'later', pushLaterAt: new Date().toISOString() })
    trackOnboarding('onboarding_permission', { kind: 'push', granted })
    setPushBusy(false)
  }

  const laterPush = () => patch({ push: 'later', pushLaterAt: new Date().toISOString() })

  return (
    <JourneyFrame
      {...chrome}
      footer={
        <Button size="cta" className="w-full" onClick={chrome.next}>
          {c.cont}
        </Button>
      }
    >
      <h1 className={stepTitle}>{c.automate.title}</h1>
      <p className={stepLead}>{c.automate.lead}</p>

      <Card className="mt-[18px] flex flex-col gap-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]"><MessageSquare className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-[var(--color-brand-text-primary)]">{c.automate.smsTitle}</p>
            <p className="text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{c.automate.smsSub}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2" aria-label={c.automate.smsTitle}>
          <p className="rounded-2xl rounded-es-sm bg-[var(--color-brand-elevated)] px-3 py-2.5 text-[0.78125rem] leading-snug text-[var(--color-brand-text-secondary)]" dir="ltr">{c.automate.smsExample}</p>
          <p className="flex items-center gap-2 text-xs text-[var(--color-brand-text-muted)]"><ArrowDown className="size-4" aria-hidden />{c.automate.becomes}</p>
          <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-2">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-cat-3)] text-white"><ShoppingCart className="size-5" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{c.automate.merchant}</p>
              <p className="text-xs text-[var(--color-brand-text-muted)]">{c.automate.category}</p>
            </div>
            <span className="font-mono-numbers text-[0.9375rem]" dir="ltr">−245.00</span>
          </div>
        </div>
        {smsDone ? (
          <p className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-brand-green)]"><Check className="size-4" aria-hidden />{c.automate.done}</p>
        ) : smsUnconfirmed ? (
          <p className="flex min-h-11 items-center text-sm font-semibold text-[var(--color-brand-text-muted)]">{guide.notConfirmed}</p>
        ) : (
          <div className="flex gap-2">
            <Button size="touch" className="flex-[1.4]" onClick={askSms} loading={sms.loading}>{c.automate.turnOn}</Button>
            <Button size="touch" variant="outline" className="flex-1" onClick={chrome.next}>{c.automate.notNow}</Button>
          </div>
        )}
      </Card>

      <Card className="mt-3 flex flex-col gap-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-cat-4)] text-white"><Bell className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-[var(--color-brand-text-primary)]">{c.automate.pushTitle}</p>
            <p className="text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{c.automate.pushSub}</p>
          </div>
        </div>
        {record?.push === 'allowed' ? (
          <p className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-brand-green)]"><Check className="size-4" aria-hidden />{c.automate.done}</p>
        ) : (
          <div className="flex gap-2">
            <Button size="touch" variant="outline" className="flex-[1.4]" loading={pushBusy} onClick={() => void allowPush()}>{c.automate.pushAllow}</Button>
            <Button size="touch" variant="ghost" className="flex-1" onClick={laterPush}>{c.automate.notNow}</Button>
          </div>
        )}
      </Card>

      {sheet === 'android' ? (
        <SmsSetupScreen onBack={() => setSheet(null)}>
          <SmsBrandIntro
            platform="android"
            cta={setupCopy.turnOnAndroid}
            onCta={() => void allowSms()}
            ctaLoading={sms.loading}
            link={{ label: setupCopy.later, onClick: () => setSheet(null) }}
            caption={setupCopy.capAndroid}
            onClose={() => setSheet(null)}
          />
        </SmsSetupScreen>
      ) : null}

      {sheet === 'ios' && iosMajor !== undefined ? (
        <SmsSetupGuide variant={guideVariantFor(iosMajor)} onClose={() => setSheet(null)} onComplete={sms.completeIosSetup} error={sms.error} />
      ) : null}
    </JourneyFrame>
  )
}
