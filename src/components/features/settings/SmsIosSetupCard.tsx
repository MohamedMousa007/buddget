'use client'

import { useState } from 'react'
import { ShieldCheck, Zap } from 'lucide-react'
import { useT } from '@/lib/i18n'
import SmsTrackingGuide from '@/components/onboarding/SmsTrackingGuide'
import { Button } from '@/components/ui/button'


interface Props {
  lastReceivedAt: string | null
  /** Fired when the user finishes the setup guide — arms the bridge + reveals the switch. */
  onSetupComplete?: () => void
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

function isRecent(iso: string | null): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000
}

export function SmsIosSetupCard({ lastReceivedAt, onSetupComplete }: Props) {
  const t = useT()
  const [showSetup, setShowSetup] = useState(false)
  const connected = isRecent(lastReceivedAt)

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
          <span>
            {connected
              ? t.smsTracking.iosStatusConnected(timeAgo(lastReceivedAt!))
              : t.smsTracking.iosStatusWaiting}
          </span>
        </div>

        {/* CTA — always red; connection state is communicated by the pill above */}
        <Button
          size="cta-block"
          onClick={() => setShowSetup(true)}
          className="h-14 font-bold shadow-[var(--shadow-md)]"
        >
          <Zap className="h-4 w-4" strokeWidth={2.5} />
          {connected ? t.smsTracking.iosSetupButtonConnected : t.smsTracking.iosSetupButton}
        </Button>
      </div>

      {showSetup && (
        <SmsTrackingGuide
          onClose={() => setShowSetup(false)}
          onComplete={onSetupComplete}
        />
      )}
    </>
  )
}
