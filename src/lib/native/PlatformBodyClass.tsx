'use client'

import { useEffect } from 'react'
import { getPlatform, isNative } from '@/lib/native/isNative'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'

const PLATFORM_CLASSES = ['platform-ios', 'platform-android', 'platform-web', 'platform-native'] as const

/**
 * Adds `platform-ios | platform-android | platform-web` (+ `platform-native`)
 * to `<body>` so global CSS can apply native-only padding, status-bar offsets,
 * and tap-highlight resets. Also configures the StatusBar + dismisses the
 * splash screen once the JS layer is mounted.
 */
export function PlatformBodyClass() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const platform = getPlatform()
    const native = isNative()

    const body = document.body
    body.classList.remove(...PLATFORM_CLASSES)
    body.classList.add(`platform-${platform}`)
    if (native) body.classList.add('platform-native')

    if (native) {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
      if (platform === 'android') {
        StatusBar.setBackgroundColor({ color: '#0A0A0F' }).catch(() => {})
      }
      SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {})
    }
  }, [])

  return null
}
