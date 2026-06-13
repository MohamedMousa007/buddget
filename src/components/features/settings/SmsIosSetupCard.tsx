'use client'

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useT } from '@/lib/i18n'
import SmsTrackingGuide from '@/components/onboarding/SmsTrackingGuide'

interface Props {
  lastReceivedAt: string | null
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

export function SmsIosSetupCard({ lastReceivedAt }: Props) {
  const t = useT()
  const [showSetup, setShowSetup] = useState(false)
  const connected = !!lastReceivedAt

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

        {/* Setup CTA */}
        <button
          type="button"
          onClick={() => setShowSetup(true)}
          className="w-full h-12 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-sm font-semibold text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-card)] transition-colors"
        >
          {connected ? t.smsTracking.iosSetupButtonConnected : t.smsTracking.iosSetupButton}
        </button>
      </div>

      {showSetup && <SmsTrackingGuide onClose={() => setShowSetup(false)} />}
    </>
  )
}
