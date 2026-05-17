'use client'

import { useState, useCallback } from 'react'
import { MessageSquare, Smartphone, Zap, RotateCcw } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useT } from '@/lib/i18n'
import { useSmsTracking } from '@/hooks/useSmsTracking'
import { SmsRecentEventsTable } from '@/components/features/settings/SmsRecentEventsTable'
import { SmsIosSetupCard } from '@/components/features/settings/SmsIosSetupCard'
import { SmsAndroidSetupCard } from '@/components/features/settings/SmsAndroidSetupCard'
import { SmsSupportedBanksList } from '@/components/features/settings/SmsSupportedBanksList'

/** Top-level section card for the Settings page. */
export function SettingsSmsTrackingSection() {
  const t = useT()
  const {
    isEnabled,
    toggle,
    loading,
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

  const handleRotate = useCallback(async () => {
    if (!rotateConfirm) {
      setRotateConfirm(true)
      return
    }
    await rotateToken()
    setRotateConfirm(false)
  }, [rotateConfirm, rotateToken])

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] divide-y divide-[var(--color-brand-border)]">
      {/* Header + toggle */}
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
        {isEnabled && (
          <p className="text-xs text-[var(--color-brand-text-muted)] mt-2">
            {t.smsTracking.toggleHint}
          </p>
        )}
      </div>

      {isEnabled && (
        <>
          {/* iOS setup */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="h-4 w-4 text-[var(--color-brand-text-muted)]" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand-text-muted)]">
                {t.smsTracking.iosCardTitle}
              </h3>
            </div>
            <SmsIosSetupCard downloadUrl={iosDownloadUrl} onFetchToken={fetchToken} />
          </div>

          {/* Android setup */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-[var(--color-brand-text-muted)]" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand-text-muted)]">
                {t.smsTracking.androidCardTitle}
              </h3>
            </div>
            <SmsAndroidSetupCard tokenInfo={tokenInfo} />
          </div>

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

          {/* Supported banks */}
          <div className="px-4 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand-text-muted)] mb-3">
              {t.smsTracking.supportedBanksTitle}
            </h3>
            <SmsSupportedBanksList />
          </div>

          {/* Token rotation */}
          {tokenInfo && (
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--color-brand-text-muted)]">
                Token: <code className="font-mono text-[10px]">{tokenInfo.token.slice(0, 8)}&hellip;</code>
              </span>
              <button
                type="button"
                onClick={handleRotate}
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
