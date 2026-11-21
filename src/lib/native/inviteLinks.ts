'use client'

import { useEffect } from 'react'
import { isNative } from '@/lib/native/isNative'
import { normalizeInviteCode, rememberInvite } from '@/components/features/invite/inviteCode'

/** Where the app opens after an invite link: same as the web `/i/<code>` route (signed out, `?next=` opens the sign-up sheet). */
export const INVITE_TARGET = '/flow?next=%2Fflow'
/** getLaunchUrl keeps returning the launch link for the life of the process: handle it once, not on every reload. */
const LAUNCH_HANDLED_KEY = 'buddget:launch-url-handled'

/** The invite code in an app/universal link, or null. Only `https://buddget.app/i/<code>` opens the app (QA-66). */
export function inviteCodeFromAppUrl(raw: string | null | undefined): string | null {
  let url: URL
  try {
    url = new URL(raw ?? '')
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.hostname !== 'buddget.app' || url.username || url.port) return null
  const match = /^\/i\/([^/]+)\/?$/.exec(url.pathname)
  if (!match) return null
  try {
    return normalizeInviteCode(decodeURIComponent(match[1]))
  } catch {
    return null
  }
}

function openInvite(url: string | undefined): boolean {
  const code = inviteCodeFromAppUrl(url)
  if (!code) return false
  rememberInvite(code)
  window.location.assign(INVITE_TARGET)
  return true
}

/** Routes an invite link that opened the native app (warm: appUrlOpen; cold: getLaunchUrl) into the sign-up flow. Mounted for signed-out users too. */
export function NativeInviteLinks() {
  useEffect(() => {
    if (!isNative()) return
    let remove: (() => void) | undefined
    let cancelled = false
    void import('@capacitor/app').then(async ({ App }) => {
      const handle = await App.addListener('appUrlOpen', ({ url }) => { openInvite(url) })
      if (cancelled) return void handle.remove()
      remove = () => void handle.remove()
      const launch = (await App.getLaunchUrl())?.url
      let handled: string | null = null
      try { handled = window.sessionStorage.getItem(LAUNCH_HANDLED_KEY) } catch { /* unreadable */ }
      if (!launch || launch === handled) return
      try { window.sessionStorage.setItem(LAUNCH_HANDLED_KEY, launch) } catch { /* unreadable */ }
      openInvite(launch)
    }).catch(() => undefined)
    return () => {
      cancelled = true
      remove?.()
    }
  }, [])
  return null
}
