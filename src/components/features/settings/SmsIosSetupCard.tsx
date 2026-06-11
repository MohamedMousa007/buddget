'use client'

import { ShieldCheck } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { SmsIosWalkthrough } from '@/components/features/settings/SmsIosWalkthrough'

interface Props {
  lastReceivedAt: string | null
}

/** Short relative-time formatter — avoids pulling in a date library. */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

/**
 * iOS Shortcut setup assistant: live connection pill + the illustrated
 * walkthrough that wires a Shortcuts automation to the native
 * "Catch Bank SMS" App Intent.
 */
export function SmsIosSetupCard({ lastReceivedAt }: Props) {
  const t = useT()
  const connected = !!lastReceivedAt

  return (
    <div className="space-y-4">
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

      <SmsIosWalkthrough />
    </div>
  )
}
