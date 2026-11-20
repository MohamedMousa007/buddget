'use client'

import { useState } from 'react'
import { ShieldCheck, Zap } from 'lucide-react'
import { useT } from '@/lib/i18n'
import SmsTrackingGuide from '@/components/onboarding/SmsTrackingGuide'
import { Button } from '@/components/ui/button'
import type { SmsSetupState } from '@/lib/sms/setupState'

interface Props {
  setup: SmsSetupState
  /** Fired when the user finishes the guide or confirms the skip: records the claim and arms. False keeps the guide open. */
  onSetupComplete?: () => Promise<boolean>
  error?: string | null
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

/** This phone's status, from what a run or an SMS proved (BDG-008); it never says a Shortcut exists or was deleted. */
function statusLabel(t: ReturnType<typeof useT>['smsTracking'], s: SmsSetupState): string {
  if (s.health === 'receiving') return t.iosStatusConnected(timeAgo(s.lastSmsAt!))
  if (s.health === 'quiet') return t.iosStatusQuiet(s.quietDays)
  if (s.runSeen) return t.iosStatusRunSeen
  return s.claimed ? t.iosStatusNotConfirmed : t.iosStatusNotSetUp
}

export function SmsIosSetupCard({ setup, onSetupComplete, error }: Props) {
  const t = useT()
  const [showSetup, setShowSetup] = useState(false)
  const connected = setup.health === 'receiving'

  return (
    <>
      <div className="space-y-3">
        {/* Connection status pill */}
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
            connected
              ? 'bg-[var(--color-brand-green)]/10 text-[var(--color-brand-green)]'
              : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)]'
          }`}
        >
          {connected ? (
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-brand-text-muted)] animate-pulse" />
          )}
          <span>{statusLabel(t.smsTracking, setup)}</span>
        </div>

        {/* CTA — always red; connection state is communicated by the pill above */}
        <Button
          size="cta-block"
          onClick={() => setShowSetup(true)}
          className="h-14 font-bold shadow-[var(--shadow-md)]"
        >
          <Zap className="h-4 w-4" strokeWidth={2.5} />
          {setup.showSwitch ? t.smsTracking.iosSetupButtonConnected : t.smsTracking.iosSetupButton}
        </Button>
      </div>

      {showSetup && (
        <SmsTrackingGuide
          onClose={() => setShowSetup(false)}
          onComplete={onSetupComplete}
          verified={setup.verified}
          error={error}
        />
      )}
    </>
  )
}
