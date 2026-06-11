'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, Copy, Check, ShieldCheck } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { isNative, isIOS } from '@/lib/native/isNative'

interface Props {
  downloadUrl: string | null
  onFetchToken: () => Promise<void>
  lastReceivedAt: string | null
}

/**
 * Consolidated bank-SMS trigger keywords for the iOS "Message contains" automation.
 * Mirrors the canonical vocabulary in `isBankishMessage` (src/lib/native/smsTracker.ts).
 */
const IOS_TRIGGER_KEYWORDS =
  'EGP, جنيه, AED, SAR, QAR, KWD, OMR, BHD, debited, spent at, purchase of, transaction of, withdrawn, تم خصم, تم سحب, تم دفع, عملية شراء'

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
 * Premium, status-aware iOS Shortcut setup assistant.
 * Guides the user through the one-time Shortcuts + Automation flow and shows a
 * live connection pill once the bridge has delivered its first SMS.
 */
export function SmsIosSetupCard({ downloadUrl, onFetchToken, lastReceivedAt }: Props) {
  const t = useT()
  const [copied, setCopied] = useState(false)

  // Pre-fetch the token on mount so the Download button is immediately one-tap.
  useEffect(() => {
    if (!downloadUrl) void onFetchToken()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCopyKeywords = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(IOS_TRIGGER_KEYWORDS)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }, [])

  const connected = !!lastReceivedAt

  const steps = [
    {
      title: t.smsTracking.iosStepInstallTitle,
      desc: t.smsTracking.iosStepInstallDesc,
      body: (
        <button
          type="button"
          onClick={() => {
            if (!downloadUrl) return
            // On iOS native, use the Shortcuts deep link so the app fetches the
            // shortcut directly — downloading as a file is blocked by iOS 16+ as
            // "unsigned". On web/Android, fall back to a direct download.
            if (isNative() && isIOS()) {
              window.location.href = `shortcuts://import-shortcut?url=${encodeURIComponent(downloadUrl)}&name=Buddget%20SMS%20Tracker`
            } else {
              window.open(downloadUrl, '_blank')
            }
          }}
          disabled={!downloadUrl}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-brand-green)] px-4 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          {downloadUrl ? t.smsTracking.iosDownloadButton : t.smsTracking.iosDownloading}
        </button>
      ),
    },
    {
      title: t.smsTracking.iosStepKeywordsTitle,
      desc: t.smsTracking.iosStepKeywordsDesc,
      body: (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void handleCopyKeywords()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 text-xs font-semibold text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-border)]/40 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[var(--color-brand-green)]" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t.smsTracking.iosCopiedKeywords : t.smsTracking.iosCopyKeywords}
          </button>
          <p className="rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2 text-[10px] leading-relaxed text-[var(--color-brand-text-muted)] break-words">
            {IOS_TRIGGER_KEYWORDS}
          </p>
        </div>
      ),
    },
    {
      title: t.smsTracking.iosStepAutomationTitle,
      desc: t.smsTracking.iosStepAutomationDesc,
      body: null,
    },
  ]

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

      {/* Numbered steps */}
      <ol className="space-y-4">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center bg-[var(--color-brand-green)]/10 text-[var(--color-brand-green)] text-xs font-semibold">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0 space-y-2 pt-0.5">
              <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{step.title}</p>
              <p className="text-xs text-[var(--color-brand-text-muted)] leading-relaxed">{step.desc}</p>
              {step.body}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
