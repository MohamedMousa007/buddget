'use client'

import { useCallback } from 'react'
import { useActionToast } from '@/components/ui/ActionToast'
import { navigate } from '@/lib/navigation/navigate'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { SETTING_BY_ID, type SettingId } from '@/lib/settings/registry'

/**
 * Takes the user to a setting: opens its sheet, runs its one-tap action, or navigates to its page
 * and asks that page to highlight the row.
 */
export function useOpenSetting() {
  const copy = useSettingsHubCopy()
  const toast = useActionToast()
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const setFocusId = useSettingsStore((s) => s.setSettingsFocusId)
  const restoreDismissedPrompts = useSettingsStore((s) => s.restoreDismissedPrompts)

  return useCallback(
    (id: SettingId) => {
      const entry = SETTING_BY_ID[id]
      switch (entry.action) {
        case 'paymentMethods': return setActiveModal('paymentMethods')
        case 'household': return setActiveModal('householdRent')
        case 'lifestyle': return setActiveModal('lifestyle')
        case 'resetTips':
          restoreDismissedPrompts()
          return toast(copy.dataPage.resetTipsDone)
        default:
          setFocusId(id)
          navigate(entry.route)
      }
    },
    [copy, toast, setActiveModal, setFocusId, restoreDismissedPrompts],
  )
}
