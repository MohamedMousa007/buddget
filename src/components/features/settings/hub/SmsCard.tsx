'use client'

import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { GROUP_TONE } from '@/components/features/settings/groupMeta'
import { AppLink } from '@/components/ui/AppLink'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { useSmsTracking } from '@/hooks/useSmsTracking'
import { useT } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { isIOS, isNative } from '@/lib/native/isNative'
import type { SmsSetupState } from '@/lib/sms/setupState'
import { cn } from '@/lib/utils'

/** This phone's status in one line, from what a run or an SMS proved (BDG-008); never says a Shortcut exists or was deleted. */
function statusLabel(t: ReturnType<typeof useT>['smsTracking'], connected: string, s: SmsSetupState): string {
  if (s.health === 'receiving') return connected
  if (s.health === 'quiet') return t.iosStatusQuiet(s.quietDays)
  if (s.runSeen) return t.iosStatusRunSeen
  return s.claimed ? t.iosStatusNotConfirmed : t.iosStatusNotSetUp
}

/**
 * SMS tracking on the settings page (BDG-008, findings/B-sms-setup.md). An iPhone that never set up on this phone gets a
 * "Set up" button and no switch; once it has a setup claim or a Shortcut run here, the switch with "View guide" before it
 * and this phone's status. Android and web: the switch alone. `children` are more rows of the same group.
 */
export function SmsCard({ title, vivid = false, children }: { title?: string; vivid?: boolean; children?: ReactNode }) {
  const copy = useSettingsHubCopy()
  const t = useT()
  const iosGuide = isNative() && isIOS()
  const { isEnabled, isSetup, toggle, loading, error, permission, setup } = useSmsTracking({ withDeviceSms: iosGuide })
  const setUpAgain = iosGuide && isSetup && setup.setUpAgain
  const needsGuide = (iosGuide && !isSetup) || setUpAgain
  const notice = error ?? (isEnabled && permission === false ? copy.sms.permissionOff : null)
  const tone = vivid ? 1 : GROUP_TONE.autoTrack
  const hint = iosGuide && isEnabled ? statusLabel(t.smsTracking, copy.sms.connected, setup) : isEnabled ? copy.sms.on : copy.sms.hint

  return (
    <SettingsSection title={title ?? copy.groupName.autoTrack}>
      {needsGuide ? (
        <SettingsRow
          icon={SETTING_ICONS.message}
          tone={tone}
          solid={vivid}
          title={copy.sms.title}
          subtitle={setUpAgain ? t.smsTracking.iosStatusQuiet(setup.quietDays) : copy.sms.iosHint}
          href="/settings/sms"
          settingId="sms"
          trailing={<span data-testid="sms-setup-button" className={buttonVariants({ size: 'touch' })}>{setUpAgain ? copy.sms.setUpAgain : copy.sms.guide}</span>}
        />
      ) : (
        <SettingsSwitchRow
          id="sms"
          label={copy.sms.title}
          tone={tone}
          solid={vivid}
          hint={hint}
          checked={isEnabled}
          onChange={(next) => void toggle(next)}
          disabled={loading}
          accessory={
            iosGuide ? (
              <AppLink href="/settings/sms" data-testid="sms-view-guide" className={cn(buttonVariants({ variant: 'ghost', size: 'touch' }), 'px-3 text-[var(--color-brand-primary-ink)]')}>
                {copy.sms.viewGuide}
              </AppLink>
            ) : undefined
          }
        />
      )}
      {notice ? (
        <p className="flex items-start gap-2 px-4 py-3 text-xs text-[var(--color-brand-amber)]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{notice}</span>
        </p>
      ) : null}
      {children}
    </SettingsSection>
  )
}
