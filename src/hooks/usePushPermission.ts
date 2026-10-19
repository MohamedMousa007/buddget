'use client'

import { useEffect, useState } from 'react'
import { isNative } from '@/lib/native/isNative'

export type PushPermission = 'checking' | 'allowed' | 'blocked' | 'notAsked' | 'unsupported'

/** Whether this device lets Buddget send notifications: the OS permission, not a Buddget setting. */
export function usePushPermission(): PushPermission {
  const [state, setState] = useState<PushPermission>('checking')

  useEffect(() => {
    let live = true
    const set = (s: PushPermission) => { if (live) setState(s) }
    if (isNative()) {
      import('@capacitor/push-notifications')
        .then(({ PushNotifications }) => PushNotifications.checkPermissions())
        .then(({ receive }) => set(receive === 'granted' ? 'allowed' : receive === 'denied' ? 'blocked' : 'notAsked'))
        .catch(() => set('unsupported'))
    } else if (typeof Notification === 'undefined') {
      set('unsupported')
    } else {
      set(Notification.permission === 'granted' ? 'allowed' : Notification.permission === 'denied' ? 'blocked' : 'notAsked')
    }
    return () => { live = false }
  }, [])

  return state
}
