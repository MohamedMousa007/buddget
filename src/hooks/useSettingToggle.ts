'use client'

import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { SettingId } from '@/lib/settings/registry'
import type { Currency } from '@/lib/store/types'

/** Settings that flip in place. Two-step, SMS and notifications have their own flows on the settings page. */
export const TOGGLE_SETTING_IDS = [
  'secondaryCurrency', 'goldStrip', 'showCents',
  'subDueReminders', 'subPriceAlerts', 'goalProgressAlerts', 'goalAlerts',
  'tips', 'learning', 'voiceReadAloud',
] as const satisfies readonly SettingId[]

export type ToggleSettingId = (typeof TOGGLE_SETTING_IDS)[number]

export function isToggleSetting(id: SettingId): id is ToggleSettingId {
  return (TOGGLE_SETTING_IDS as readonly SettingId[]).includes(id)
}

/** A second currency that is not the base. */
export function defaultSecondCurrency(base: Currency): Currency {
  return base === 'USD' ? 'EUR' : 'USD'
}

export interface SettingToggle {
  on: boolean
  set: (next: boolean) => void
}

/** Current value and setter for one in-place toggle; every toggle lives in exactly one store field. */
export function useSettingToggle(id: ToggleSettingId): SettingToggle {
  const fin = useFinanceStore(
    useShallow((s) => ({ settings: s.settings, updateSettings: s.updateSettings })),
  )
  const ui = useSettingsStore(
    useShallow((s) => ({
      tips: s.buddgyNudges,
      learning: s.buddgyLearning,
      muted: s.voiceSpeakMuted,
      setTips: s.setBuddgyNudges,
      setLearning: s.setBuddgyLearning,
      setMuted: s.setVoiceSpeakMuted,
    })),
  )
  const { settings, updateSettings } = fin

  const set = useCallback(
    (next: boolean) => {
      switch (id) {
        case 'secondaryCurrency': {
          const current = settings.secondaryCurrency
          updateSettings({
            showSecondaryCurrency: next,
            ...(next && (!current || current === settings.baseCurrency)
              ? { secondaryCurrency: defaultSecondCurrency(settings.baseCurrency) }
              : {}),
          })
          return
        }
        case 'goldStrip': return updateSettings({ wealthGoldStrip: next ? 'collapsed' : 'hidden' })
        case 'showCents': return updateSettings({ showCentsInDashboard: next })
        case 'subDueReminders': return updateSettings({ subDueReminders: next })
        case 'subPriceAlerts': return updateSettings({ subPriceAlerts: next })
        case 'goalProgressAlerts': return updateSettings({ goalProgressAlerts: next })
        case 'goalAlerts': return updateSettings({ goalAlerts: next })
        case 'tips': return ui.setTips(next)
        case 'learning': return ui.setLearning(next)
        case 'voiceReadAloud': return ui.setMuted(!next)
      }
    },
    [id, settings.secondaryCurrency, settings.baseCurrency, updateSettings, ui],
  )

  const on = (() => {
    switch (id) {
      case 'secondaryCurrency': return settings.showSecondaryCurrency
      case 'goldStrip': return settings.wealthGoldStrip !== 'hidden'
      case 'showCents': return settings.showCentsInDashboard
      case 'subDueReminders': return settings.subDueReminders ?? true
      case 'subPriceAlerts': return settings.subPriceAlerts ?? true
      case 'goalProgressAlerts': return settings.goalProgressAlerts ?? true
      case 'goalAlerts': return settings.goalAlerts ?? true
      case 'tips': return ui.tips
      case 'learning': return ui.learning
      case 'voiceReadAloud': return !ui.muted
    }
  })()

  return { on, set }
}
