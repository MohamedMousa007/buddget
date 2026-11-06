'use client'

import { useState } from 'react'
import { ArrowDown, Bell, Check, MessageSquare, ShoppingCart, Zap } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useSmsTracking } from '@/hooks/useSmsTracking'
import { createClient } from '@/lib/supabase/client'
import { isIOS } from '@/lib/native/isNative'
import { registerPushNotifications } from '@/lib/native/pushNotifications'
import { navigate } from '@/lib/navigation/navigate'
import { trackOnboarding } from '@/lib/onboarding/track'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { stepLead, stepTitle } from './BuddgyHead'
import type { StepChrome } from './chrome'
import { JourneyFrame } from './JourneyFrame'
import { useOnboarding } from './useOnboarding'
import { useOnboardingCopy } from './useOnboardingCopy'
import { ModalTitle } from '@/components/modals/ModalTitle'

type Sheet = 'android' | 'ios' | null

/** Step 5 (apps only): bank-text capture and reminders, each shown working before it asks for anything. */
export function StepAutomate({ chrome }: { chrome: StepChrome }) {
  const c = useOnboardingCopy()
  const sms = useSmsTracking()
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

  const setupIos = () => {
    setSheet(null)
    chrome.next()
    navigate('/settings/sms')
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
        {sms.isEnabled ? (
          <p className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-brand-green)]"><Check className="size-4" aria-hidden />{c.automate.done}</p>
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

      <ModalShell open={sheet === 'android'} onBackdropClick={() => setSheet(null)} padContent>
        <div className="flex flex-col gap-3 pt-1">
          <ModalTitle className="text-[21px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{c.android.title}</ModalTitle>
          <ul className="flex flex-col gap-3">
            {c.android.bullets.map((b) => (
              <li key={b} className="flex gap-3 text-[0.90625rem] text-[var(--color-brand-text-secondary)]">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]"><Check className="size-3.5" strokeWidth={3} aria-hidden /></span>
                {b}
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--color-brand-text-muted)]">{c.android.note}</p>
          <Button size="cta" className="w-full" onClick={() => void allowSms()}>{c.android.cont}</Button>
          <Button variant="ghost" size="touch" className="w-full" onClick={() => setSheet(null)}>{c.android.notNow}</Button>
        </div>
      </ModalShell>

      <ModalShell open={sheet === 'ios'} onBackdropClick={() => setSheet(null)} padContent>
        <div className="flex flex-col gap-3 pt-1">
          <ModalTitle className="text-[21px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{c.ios.title}</ModalTitle>
          <p className="text-[0.90625rem] leading-snug text-[var(--color-brand-text-secondary)]">{c.ios.lead}</p>
          <div className="flex items-start gap-1.5 rounded-2xl bg-[var(--color-brand-elevated)] p-3.5">
            {[MessageSquare, Zap, Check].map((Icon, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5 text-center">
                <span className="flex size-10 items-center justify-center rounded-xl text-white" style={{ background: `var(--color-cat-${[5, 6, 1][i]})` }}><Icon className="size-5" aria-hidden /></span>
                <span className="text-xs font-semibold text-[var(--color-brand-text-primary)]">{c.ios.steps[i]}</span>
              </div>
            ))}
          </div>
          <Button size="cta" className="w-full" onClick={setupIos}>{c.ios.setup}</Button>
          <Button variant="ghost" size="touch" className="w-full" onClick={() => setSheet(null)}>{c.ios.later}</Button>
          <p className="text-center text-xs text-[var(--color-brand-text-muted)]">{c.ios.remind}</p>
        </div>
      </ModalShell>
    </JourneyFrame>
  )
}
