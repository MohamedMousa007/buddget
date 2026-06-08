'use client'

import { useState, useCallback } from 'react'
import { MessageSquare, ChevronDown, RotateCcw, AlertTriangle } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useT } from '@/lib/i18n'
import { useSmsTracking } from '@/hooks/useSmsTracking'
import { SmsRecentEventsTable } from '@/components/features/settings/SmsRecentEventsTable'
import { SmsIosSetupCard } from '@/components/features/settings/SmsIosSetupCard'
import { SmsAndroidSetupCard } from '@/components/features/settings/SmsAndroidSetupCard'
import { SmsSupportedBanksList } from '@/components/features/settings/SmsSupportedBanksList'
import { isAndroid } from '@/lib/native/isNative'

/** Top-level section card for the Settings page. */
export function SettingsSmsTrackingSection() {
  const t = useT()
  const {
    isEnabled,
    toggle,
    loading,
    error,
    tokenInfo,
    fetchToken,
    rotateToken,
    recentEvents,
    undo,
    undoingId,
    undoMessage,
    iosDownloadUrl,
  } = useSmsTracking()

  const [rotateConfirm, setRotateConfirm] = useState(false)
  const [showBanks, setShowBanks] = useState(false)

  const handleRotate = useCallback(async () => {
    if (!rotateConfirm) { setRotateConfirm(true); return }
    await rotateToken()
    setRotateConfirm(false)
  }, [rotateConfirm, rotateToken])

  const onAndroid = isAndroid()

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] divide-y divide-[var(--color-brand-border)]">
      {/* Header + toggle — always visible */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 mb-1">
          <span className="h-8 w-8 rounded-xl flex items-center justify-center bg-[var(--color-brand-green)]/10 text-[var(--color-brand-green)]">
            <MessageSquare className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-[var(--color-brand-text-primary)]">
            {t.smsTracking.sectionTitle}
          </h2>
        </div>
        <p className="text-xs text-[var(--color-brand-text-muted)] mb-4 ml-11">
          {t.smsTracking.sectionSubtitle}
        </p>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-sm text-[var(--color-brand-text-secondary)]">
            {t.smsTracking.toggleLabel}
          </Label>
          <Switch checked={isEnabled} onCheckedChange={toggle} disabled={loading} />
        </div>
        {error && (
          <div className="flex items-start gap-2 mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {isEnabled && (
        <>
          {/* Android native: active badge + banks accordion + keyword accordion */}
          {onAndroid && (
            <div className="px-4 py-4">
              <SmsAndroidSetupCard />
            </div>
          )}

          {/* iOS / web: shortcut setup guide */}
          {!onAndroid && (
            <div className="px-4 py-4">
              <SmsIosSetupCard downloadUrl={iosDownloadUrl} onFetchToken={fetchToken} />
            </div>
          )}

          {/* Recent auto-tracked transactions */}
          <div className="px-4 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand-text-muted)] mb-3">
              {t.smsTracking.recentTitle}
            </h3>
            <SmsRecentEventsTable
              events={recentEvents}
              onUndo={undo}
              undoingId={undoingId}
              undoMessage={undoMessage}
            />
          </div>

          {/* Supported banks — iOS / web only (Android shows inline accordion) */}
          {!onAndroid && (
            <div className="px-4 py-3">
              <button
                type="button"
                onClick={() => setShowBanks((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)] transition-colors"
              >
                <span>{t.smsTracking.supportedBanksTitle}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${showBanks ? 'rotate-180' : ''}`}
                />
              </button>
              {showBanks && <div className="mt-3"><SmsSupportedBanksList /></div>}
            </div>
          )}

          {/* Token rotation — iOS / web only */}
          {tokenInfo && !onAndroid && (
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--color-brand-text-muted)]">
                Token: <code className="font-mono text-[10px]">{tokenInfo.token.slice(0, 8)}&hellip;</code>
              </span>
              <button
                type="button"
                onClick={() => void handleRotate()}
                className="flex items-center gap-1.5 text-xs text-[var(--color-brand-red)] hover:opacity-80 transition-opacity"
              >
                <RotateCcw className="h-3 w-3" />
                {rotateConfirm ? t.smsTracking.tokenRotateConfirm : t.smsTracking.tokenRotateButton}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
