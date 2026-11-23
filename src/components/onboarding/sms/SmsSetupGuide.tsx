'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { BellOff, Check, ChevronLeft, Play, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { GROUP_TONE } from '@/components/features/settings/groupMeta'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { isNative } from '@/lib/native/isNative'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { Emphasis } from './Emphasis'
import { GuideWalkthrough } from './GuideWalkthrough'
import { SmsBrandIntro } from './SmsBrandIntro'
import { IOS26_ASPECT, IOS26_STEPS, IOS26_STOPS, IOS27_ASPECT, IOS27_STOPS, IOS27_WALKTHROUGH } from './guideStops'
import type { GuideStart } from './guideLaunch'

/** The shared "Buddget SMS" shortcut (iOS 27+): the trigger and both fields come wired, only the automation switch is off. */
export const SHARED_SHORTCUT_URL = 'https://www.icloud.com/shortcuts/82d9029ba5fa408eb900d57bdfad424c'

async function openUrl(url: string) {
  try { const { AppLauncher } = await import('@capacitor/app-launcher'); await AppLauncher.openUrl({ url }); return } catch { /* web fallback below */ }
  // Never navigate the app's own WebView to an outside page.
  if (!isNative()) window.location.href = url
}

export interface SmsSetupGuideProps {
  /** 'shortcut': iOS 27+, add the shared shortcut. 'manual': iOS 16.4-26, build the automation by hand. */
  variant: 'shortcut' | 'manual'
  start?: GuideStart
  onClose?: () => void
  /** Records the setup claim and arms this phone. Resolving false keeps the guide open; show why through `error`. */
  onComplete?: () => Promise<boolean> | boolean | void
  error?: string | null
}

type Screen = { at: 'intro' } | { at: 'how' } | { at: 'step'; index: number } | { at: 'done' }

/** The iPhone SMS setup guide (approved mockups sms-guide-ios27-v2 and sms-guide-ios26-v2). Full screen. */
export function SmsSetupGuide({ variant, start = 'intro', onClose, onComplete, error = null }: SmsSetupGuideProps) {
  const c = useT().smsSetup
  const [screen, setScreen] = useState<Screen>(variant === 'shortcut' && start === 'walkthrough' ? { at: 'how' } : { at: 'intro' })
  const [busy, setBusy] = useState(false)
  const close = useCallback(() => (onClose ? onClose() : window.history.back()), [onClose])

  /** Claim first, then leave the app: a request started as the app backgrounds can be suspended. */
  const complete = useCallback(async (then?: () => Promise<void>) => {
    setBusy(true)
    const ok = await onComplete?.()
    setBusy(false)
    if (ok === false) return
    await then?.()
    setScreen({ at: 'done' })
  }, [onComplete])

  const iosSteps = useMemo(() => IOS26_STEPS.map((ids) => ({ stops: ids.map((id) => IOS26_STOPS[id]), ids })), [])
  const ios27 = useMemo(() => IOS27_WALKTHROUGH.map((id) => IOS27_STOPS[id]), [])
  const errorLine = error ? <p role="alert" className="mt-2 text-center text-xs text-[var(--color-brand-amber)]">{error}</p> : null

  return (
    <SmsSetupScreen onBack={onClose}>
        {screen.at === 'intro' ? (
          variant === 'shortcut' ? (
            <SmsBrandIntro cta={c.seeHow} ctaIcon={<Play className="size-3.5" fill="currentColor" aria-hidden />} onCta={() => setScreen({ at: 'how' })} caption={c.capShortcut} onClose={close} />
          ) : (
            <SmsBrandIntro cta={c.startSetup} onCta={() => setScreen({ at: 'step', index: 0 })} link={{ label: c.knowSteps, onClick: () => setScreen({ at: 'step', index: iosSteps.length - 1 }) }} caption={c.capManual} onClose={close} />
          )
        ) : screen.at === 'how' ? (
          <GuideScreen title={c.howTitle} onBack={() => setScreen({ at: 'intro' })} onClose={close} backLabel={c.back} closeLabel={c.close}>
            <h2 className="mt-3.5 text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{c.howHeading}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-brand-text-secondary)]">{c.howBody}</p>
            <div className="flex min-h-0 flex-1 items-center justify-center py-3">
              <GuideWalkthrough stops={ios27} tips={IOS27_WALKTHROUGH.map((id) => c.tips[id] ?? '')} aspect={IOS27_ASPECT} />
            </div>
            <PingsTip text={c.pingsTip} />
            <Button size="cta-block" className="mt-3 font-bold" loading={busy} onClick={() => void complete(() => openUrl(SHARED_SHORTCUT_URL))}>
              <Plus className="size-[18px]" strokeWidth={2.6} aria-hidden />{c.addShortcut}
            </Button>
            {errorLine}
          </GuideScreen>
        ) : screen.at === 'step' ? (
          <StepScreen
            index={screen.index}
            total={iosSteps.length}
            stops={iosSteps[screen.index].stops}
            tips={iosSteps[screen.index].ids.map((id) => c.tips[id] ?? '')}
            busy={busy}
            error={errorLine}
            onBack={() => setScreen(screen.index === 0 ? { at: 'intro' } : { at: 'step', index: screen.index - 1 })}
            onNext={() => (screen.index === iosSteps.length - 1 ? void complete() : setScreen({ at: 'step', index: screen.index + 1 }))}
            onClose={close}
          />
        ) : (
          <DoneScreen onClose={close} />
        )}
    </SmsSetupScreen>
  )
}

/** The full-screen frame every SMS setup screen sits in (guide and onboarding). `onBack`: Android hardware back closes it. */
export function SmsSetupScreen({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  useEffect(() => (onBack ? registerBackGuard(() => { onBack(); return true }) : undefined), [onBack])
  const frame = (
    <div className="fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center bg-[var(--color-brand-bg)]">
      <div className="relative flex h-full max-h-[844px] w-full max-w-[390px] flex-col overflow-hidden bg-[var(--color-brand-bg)] safe-area-top safe-area-bottom">
        {children}
      </div>
    </div>
  )
  // Portaled like ModalShell, so no transformed ancestor can trap the full-screen frame.
  return typeof document === 'undefined' ? frame : createPortal(frame, document.body)
}

function GuideScreen({ title, onBack, onClose, backLabel, closeLabel, children }: { title: string; onBack: () => void; onClose: () => void; backLabel: string; closeLabel: string; children: React.ReactNode }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-3.5" aria-label={title}>
      <div className="flex h-9 items-center gap-2.5">
        <IconButton onClick={onBack} aria-label={backLabel} variant="outlined" size="sm" shape="round"><ChevronLeft className="rtl:rotate-180" /></IconButton>
        <span className="text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{title}</span>
        <IconButton onClick={onClose} aria-label={closeLabel} variant="outlined" size="sm" shape="round" className="ms-auto"><X /></IconButton>
      </div>
      {children}
    </section>
  )
}

function PingsTip({ text }: { text: string }) {
  return (
    <div className="mt-2.5 flex items-start gap-2.5 rounded-[14px] bg-[var(--color-brand-amber-soft)] px-3 py-2.5">
      <BellOff className="mt-px size-[18px] shrink-0 text-[var(--color-brand-amber)]" aria-hidden />
      <p className="text-[0.78125rem] leading-snug text-[var(--color-brand-text-primary)]"><Emphasis text={text} boldClassName="font-bold" /></p>
    </div>
  )
}

function StepScreen({ index, total, stops, tips, busy, error, onBack, onNext, onClose }: {
  index: number
  total: number
  stops: (typeof IOS26_STOPS)[keyof typeof IOS26_STOPS][]
  tips: string[]
  busy: boolean
  error: React.ReactNode
  onBack: () => void
  onNext: () => void
  onClose: () => void
}) {
  const c = useT().smsSetup
  const step = c.steps[index]
  const last = index === total - 1
  return (
    <GuideScreen title={c.setupTitle} onBack={onBack} onClose={onClose} backLabel={c.back} closeLabel={c.close}>
      <div className="mt-3 flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1} aria-label={c.stepOf(index + 1, total)}>
        {Array.from({ length: total }, (_, i) => <span key={i} className={cn('h-1 flex-1 rounded-full', i <= index ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-sunken)]')} />)}
      </div>
      <p className="mt-2 text-[0.6875rem] font-semibold tabular-nums text-[var(--color-brand-text-muted)]">{c.stepOf(index + 1, total)}</p>
      <h2 className="mt-2.5 text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{step.title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--color-brand-text-secondary)]">{step.body}</p>
      <div className="flex min-h-0 flex-1 items-center justify-center py-3">
        <GuideWalkthrough key={index} stops={stops} tips={tips} aspect={IOS26_ASPECT} maxHeight={last ? 380 : 430} />
      </div>
      {last ? <PingsTip text={c.pingsTip} /> : null}
      <div className="mt-3 flex gap-2.5">
        <Button variant="outline" size="cta" className="flex-1 font-semibold" onClick={() => void openUrl('shortcuts://')}>{c.openShortcuts}</Button>
        <Button size="cta" className="flex-1 font-bold" loading={last && busy} onClick={onNext}>{last ? c.finish : c.next}</Button>
      </div>
      {error}
    </GuideScreen>
  )
}

function DoneScreen({ onClose }: { onClose: () => void }) {
  const c = useT().smsSetup
  const hub = useSettingsHubCopy()
  return (
    <section className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-3.5">
      <div className="flex h-9 items-center justify-end">
        <IconButton onClick={onClose} aria-label={c.close} variant="outlined" size="sm" shape="round"><X /></IconButton>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3.5 text-center">
        <span className="flex size-[76px] items-center justify-center rounded-full bg-[var(--color-brand-green)] text-[var(--color-brand-on-green)] shadow-[var(--shadow-md)]"><Check className="size-[38px]" strokeWidth={3} aria-hidden /></span>
        <h1 className="text-[26px] font-bold tracking-[-0.03em] text-[var(--color-brand-text-primary)]">{c.doneTitle}</h1>
        <p className="max-w-[290px] text-sm leading-relaxed text-[var(--color-brand-text-secondary)]">{c.doneBody}</p>
        <Card padding="none" className="pointer-events-none mt-4 w-full overflow-hidden text-start" aria-hidden>
          <SettingsSwitchRow id="sms" label={hub.sms.title} tone={GROUP_TONE.autoTrack} hint={c.doneStatus} checked onChange={() => {}} />
        </Card>
      </div>
      <Button size="cta-block" className="mt-4 font-bold" onClick={onClose}>{c.gotIt}</Button>
    </section>
  )
}
