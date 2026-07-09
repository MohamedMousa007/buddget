'use client'

import { useEffect, useRef } from 'react'
import { isAndroid } from '@/lib/native/isNative'

/**
 * Android email-OTP autofill.
 *
 * The code arrives by email, so there is no OS-level autofill on Android (that
 * only exists for SMS). The practical path: the user copies the 6-digit code
 * from the email, returns to the app, and we read it from the clipboard while
 * the app is foregrounded (allowed on Android; a system "pasted from clipboard"
 * toast may show). We attempt on mount and on every app resume.
 *
 * iOS is intentionally excluded — it fills the code natively via the input's
 * `autocomplete="one-time-code"` (Mail QuickType), and reading the clipboard
 * there would trigger a paste-permission prompt.
 */
export function useOtpAutofill(onCode: (code: string) => void, enabled = true) {
  const cb = useRef(onCode)
  cb.current = onCode

  useEffect(() => {
    if (!enabled || !isAndroid()) return
    let cancelled = false
    let remove: (() => void) | undefined

    const tryFill = async () => {
      try {
        const { Clipboard } = await import('@capacitor/clipboard')
        const { value, type } = await Clipboard.read()
        if (cancelled || (type && !type.includes('text'))) return
        const m = (value ?? '').match(/\b(\d{6})\b/)
        if (m) cb.current(m[1])
      } catch {
        /* clipboard unavailable */
      }
    }

    void tryFill()
    void (async () => {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('resume', () => void tryFill())
      if (cancelled) return void handle.remove()
      remove = () => void handle.remove()
    })()

    return () => {
      cancelled = true
      remove?.()
    }
  }, [enabled])
}
