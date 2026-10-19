'use client'

import { Card } from '@/components/ui/card'
import { QuickChanges } from '@/components/features/settings/QuickChanges'
import { CurrencyConverter } from '@/components/features/settings/CurrencyConverter'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsToggleRow } from '@/components/features/settings/SettingsToggleRow'
import { ROOM_TONE } from '@/components/features/settings/roomMeta'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { FinanceStore } from '@/lib/store/types'

export interface SettingsCurrencySectionProps {
  store: FinanceStore
}

/**
 * Main and second currency, the form-picker restriction, and the live rate converter.
 * Picking either currency goes through the app's shared currency sheet; a main-currency change asks first.
 */
export function SettingsCurrencySection({ store }: SettingsCurrencySectionProps) {
  const copy = useSettingsHubCopy()
  const second = useFinanceStore((s) => (s.settings.showSecondaryCurrency ? s.settings.secondaryCurrency : null))

  return (
    <>
      <Card padding="none" data-setting-id="baseCurrency">
        <QuickChanges variant="currency" />
      </Card>
      <SettingsSection>
        <SettingsToggleRow id="secondaryCurrency" tone={ROOM_TONE.money} hint={second ?? undefined} />
        <SettingsToggleRow id="onlyMyCurrencies" tone={ROOM_TONE.money} hint={copy.moneyPage.onlyMineHint} />
      </SettingsSection>
      <Card padding="lg" data-setting-id="converter">
        <CurrencyConverter store={store} />
      </Card>
    </>
  )
}
