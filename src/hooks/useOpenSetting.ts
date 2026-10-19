'use client'

import { useCallback } from 'react'
import { navigate } from '@/lib/navigation/navigate'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { SETTING_BY_ID, type SettingId } from '@/lib/settings/registry'

/**
 * Takes the user to a setting: opens its sheet, or goes to its page and asks it to highlight the row.
 * Most settings live on the settings page itself, so this usually just scrolls to the row.
 */
export function useOpenSetting() {
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const setFocusId = useSettingsStore((s) => s.setSettingsFocusId)
  const openSheet = useSettingsStore((s) => s.openSettingsSheet)

  return useCallback(
    (id: SettingId) => {
      const entry = SETTING_BY_ID[id]
      switch (entry.action) {
        case 'household': return setActiveModal('householdRent')
        case 'lifestyle': return setActiveModal('lifestyle')
        case 'currencies':
        case 'converter':
        case 'feedback':
        case 'about':
        case 'export':
        case 'deleteAccount':
          navigate('/settings')
          return openSheet(entry.action)
        default:
          setFocusId(id)
          navigate(entry.route)
      }
    },
    [setActiveModal, setFocusId, openSheet],
  )
}
