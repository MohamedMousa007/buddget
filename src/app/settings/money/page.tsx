'use client'

import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SettingsToggleRow } from '@/components/features/settings/SettingsToggleRow'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { ROOM_TONE } from '@/components/features/settings/roomMeta'
import { useOpenSetting } from '@/hooks/useOpenSetting'
import { useSettingValue } from '@/hooks/useSettingValue'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { AppSettings } from '@/lib/store/types'

type EntryMode = AppSettings['budgetEntryMode']

export default function SettingsMoneyPage() {
  const copy = useSettingsHubCopy()
  const open = useOpenSetting()
  const tone = ROOM_TONE.money
  const settings = useFinanceStore((s) => s.settings)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const methodCount = useFinanceStore((s) => s.paymentMethods.length)
  const second = settings.showSecondaryCurrency ? settings.secondaryCurrency : null
  const m = copy.moneyPage

  return (
    <SettingsSubPageShell title={copy.rooms.money.title}>
      <SettingsSection title={m.currency}>
        <SettingsRow
          icon={SETTING_ICONS.coins}
          tone={tone}
          title={copy.items.baseCurrency.label}
          subtitle={second ? `+ ${second}` : copy.noSecond}
          value={useSettingValue('baseCurrency')}
          href="/settings/currency"
          settingId="baseCurrency"
        />
      </SettingsSection>

      <SettingsSection title={m.cycle}>
        <SettingsRow
          icon={SETTING_ICONS.calendar}
          tone={tone}
          title={copy.items.payCycle.label}
          subtitle={copy.payCycle.hint}
          value={useSettingValue('payCycle')}
          href="/settings/pay-cycle"
          settingId="payCycle"
        />
      </SettingsSection>

      <SettingsSection title={m.wallets}>
        <SettingsRow
          icon={SETTING_ICONS.card}
          tone={tone}
          title={copy.items.paymentMethods.label}
          subtitle={m.paymentMethodsHint(methodCount)}
          onClick={() => open('paymentMethods')}
          settingId="paymentMethods"
        />
      </SettingsSection>

      <SettingsSection title={m.rules}>
        <SettingsRow icon={SETTING_ICONS.home} tone={tone} title={copy.items.household.label} subtitle={m.householdHint} onClick={() => open('household')} settingId="household" />
        <SettingsRow icon={SETTING_ICONS.home} tone={tone} title={copy.items.lifestyle.label} subtitle={m.lifestyleHint} onClick={() => open('lifestyle')} settingId="lifestyle" />
        <SettingsToggleRow id="goldStrip" tone={tone} hint={m.goldHint} />
        <div data-setting-id="budgetEntryMode" className="space-y-2.5 px-4 py-3">
          <span className="block text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{m.entryTitle}</span>
          <SegmentedControl<EntryMode>
            ariaLabel={m.entryTitle}
            value={settings.budgetEntryMode}
            onChange={(budgetEntryMode) => updateSettings({ budgetEntryMode })}
            options={[
              { value: 'amount', label: m.entryAmount },
              { value: 'percent_of_income', label: m.entryPercent },
            ]}
          />
        </div>
      </SettingsSection>
    </SettingsSubPageShell>
  )
}
