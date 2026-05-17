'use client'

import { useState } from 'react'
import { Copy, Check, Download } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { TokenInfo } from '@/hooks/useSmsTracking'

interface Props {
  tokenInfo: TokenInfo | null
}

type View = 'apk' | 'manual'

/**
 * Card shown inside SettingsSmsTrackingSection for Android setup.
 * Toggles between APK download and manual Tasker/MacroDroid instructions.
 */
export function SmsAndroidSetupCard({ tokenInfo }: Props) {
  const t = useT()
  const [view, setView] = useState<View>('apk')
  const [copied, setCopied] = useState<'webhook' | 'token' | null>(null)

  const copyText = async (text: string, field: 'webhook' | 'token') => {
    await navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-brand-text-muted)]">{t.smsTracking.androidCardSubtitle}</p>

      {/* View toggle */}
      <div className="flex gap-2">
        {(['apk', 'manual'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              view === v
                ? 'bg-[var(--color-brand-green)] text-white'
                : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)]'
            }`}
          >
            {v === 'apk' ? t.smsTracking.androidApkTitle : t.smsTracking.androidManualTitle}
          </button>
        ))}
      </div>

      {view === 'apk' && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-brand-text-muted)]">{t.smsTracking.androidApkDesc}</p>
          <ol className="space-y-1">
            {[t.smsTracking.androidApkStep1, t.smsTracking.androidApkStep2].map((step, i) => (
              <li key={i} className="text-xs text-[var(--color-brand-text-secondary)]">{step}</li>
            ))}
          </ol>
          <a
            href="/BuddgetBridge.apk"
            download
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] px-4 py-2 text-xs font-semibold text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-card)] transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            {t.smsTracking.androidApkButton}
          </a>
        </div>
      )}

      {view === 'manual' && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-brand-text-muted)]">{t.smsTracking.androidManualDesc}</p>

          {tokenInfo ? (
            <div className="space-y-2">
              {(
                [
                  { label: t.smsTracking.androidWebhookLabel, value: tokenInfo.webhookUrl, field: 'webhook' as const },
                  { label: t.smsTracking.androidTokenLabel, value: tokenInfo.token, field: 'token' as const },
                ]
              ).map(({ label, value, field }) => (
                <div key={field} className="rounded-lg bg-[var(--color-brand-elevated)] px-3 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] text-[var(--color-brand-text-muted)]">{label}</p>
                    <p className="text-xs font-mono text-[var(--color-brand-text-primary)] truncate">{value}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(value, field)}
                    className="shrink-0 text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] transition-colors"
                  >
                    {copied === field ? <Check className="h-3.5 w-3.5 text-[var(--color-brand-green)]" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-brand-text-muted)] italic">Loading&hellip;</p>
          )}
        </div>
      )}
    </div>
  )
}
