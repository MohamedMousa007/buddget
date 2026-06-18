'use client'

import { MessageSquare, AlertTriangle } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useT } from '@/lib/i18n'
import { useSmsTracking } from '@/hooks/useSmsTracking'
import { SmsIosSetupCard } from '@/components/features/settings/SmsIosSetupCard'
import { SmsAndroidSetupCard } from '@/components/features/settings/SmsAndroidSetupCard'
import { SmsBankBubbles } from '@/components/features/settings/SmsBankBubbles'
import { isAndroid, isNative, isIOS } from '@/lib/native/isNative'

/** Top-level section card for the Settings page. */
export function SettingsSmsTrackingSection() {
  const t = useT()
  const {
    isEnabled,
    isSetup,
    toggle,
    completeIosSetup,
    loading,
    error,
    lastReceivedAt,
  } = useSmsTracking()

  const onAndroid = isAndroid()
  const onIOS = isNative() && isIOS()
  // On iOS the switch is hidden until the Shortcut setup is finished; Android/web always show it.
  const showSwitch = isSetup

  return (
    <div>
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] divide-y divide-[var(--color-brand-border)]">
      {/* Header */}
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

        {showSwitch ? (
          <div className="flex items-center justify-between gap-4">
            <Label className="text-sm text-[var(--color-brand-text-secondary)]">
              {t.smsTracking.toggleLabel}
            </Label>
            <Switch checked={isEnabled} onCheckedChange={toggle} disabled={loading} />
          </div>
        ) : (
          // iOS, not yet set up: show ONLY the setup CTA (no switch).
          <SmsIosSetupCard lastReceivedAt={lastReceivedAt} onSetupComplete={completeIosSetup} />
        )}

        {error && (
          <div className="flex items-start gap-2 mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {showSwitch && isEnabled && (
        <>
          {/* Android native: active badge + banks accordion + keyword accordion */}
          {onAndroid && (
            <div className="px-4 py-4">
              <SmsAndroidSetupCard />
            </div>
          )}

          {/* iOS (set up) / web: status pill + re-open guide */}
          {!onAndroid && (
            <div className="px-4 py-4">
              <SmsIosSetupCard lastReceivedAt={lastReceivedAt} onSetupComplete={onIOS ? completeIosSetup : undefined} />
            </div>
          )}
        </>
      )}
    </section>
    {showSwitch && isEnabled && <SmsBankBubbles />}
    </div>
  )
}
