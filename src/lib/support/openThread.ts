'use client'

import { useEffect } from 'react'
import { create } from 'zustand'
import { apiFetchAuth } from '@/lib/apiBase'
import { navigate } from '@/lib/navigation/navigate'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

interface SupportThreadState {
  /** A conversation to open as soon as the messages sheet shows it (a tapped push or notification). Never persisted. */
  pending: number | null
  /** Conversations with a team reply the user has not opened. */
  unread: number
}

export const useSupportThreadStore = create<SupportThreadState>(() => ({ pending: null, unread: 0 }))

/** Opens Help and feedback on one conversation, from anywhere in the app. */
export function openSupportThread(ticketNumber: number): void {
  useSupportThreadStore.setState({ pending: ticketNumber })
  useSettingsStore.getState().openSettingsSheet('inbox')
  navigate('/settings/help')
}

/** Re-reads the unread count (the Help entry badge). Quiet on failure: a stale badge is better than an error. */
export async function refreshSupportUnread(): Promise<void> {
  try {
    const res = await apiFetchAuth('/api/support/tickets', { cache: 'no-store' })
    if (!res.ok) return
    const data = (await res.json()) as { unread?: number }
    if (typeof data.unread === 'number') useSupportThreadStore.setState({ unread: data.unread })
  } catch {
    /* keep the last count */
  }
}

/** The unread count for a badge; reads it once when the badge mounts. */
export function useSupportUnread(): number {
  useEffect(() => {
    void refreshSupportUnread()
  }, [])
  return useSupportThreadStore((s) => s.unread)
}
