'use client'

import { useEffect } from 'react'
import { useActionToast } from '@/components/ui/ActionToast'
import { useT } from '@/lib/i18n'
import { STORAGE_QUOTA_EVENT } from '@/lib/store/safeLocalStorage'

/** Warns, through the existing action toast, that the device refused a save. Side-effect only. */
export function StorageQuotaToast() {
  const showToast = useActionToast()
  const message = useT().common.storageFull
  useEffect(() => {
    const onQuota = () => showToast(message)
    window.addEventListener(STORAGE_QUOTA_EVENT, onQuota)
    return () => window.removeEventListener(STORAGE_QUOTA_EVENT, onQuota)
  }, [showToast, message])
  return null
}
