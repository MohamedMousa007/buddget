'use client'

/**
 * Cross-tab sync for guest sessions using the BroadcastChannel API.
 *
 * Problem: sessionStorage is per-tab, so two tabs of the app both show the
 * landing gate even when one tab has a live guest session. Users get confused,
 * lose data, or end up with two uncorrelated guest identities.
 *
 * Solution: when a tab starts / ends a guest session it broadcasts a tiny
 * message. Other tabs listen, and if they're currently on the landing gate
 * (or in an inconsistent state) they refresh and pick up the shared session
 * via sessionStorage on reload. We don't try to sync the Zustand state
 * itself — just the "there is a guest session" signal plus the nickname and
 * next-target. The per-tab sessionStorage silo still owns the actual data,
 * which is acceptable because only one tab actively drives guest flows at a
 * time; the other tabs become landing until the user picks up again.
 *
 * For a full multi-tab guest data sync we'd move to localStorage (or
 * anonymous auth — see strategic #1), but that's out of scope here.
 */

const CHANNEL = 'buddget-guest-v1'

export type GuestBroadcastMessage =
  | { kind: 'guest-started'; nickname: string; next: string | null }
  | { kind: 'guest-ended' }

type Unsubscribe = () => void

export function postGuestMessage(msg: GuestBroadcastMessage): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
  try {
    const ch = new BroadcastChannel(CHANNEL)
    ch.postMessage(msg)
    ch.close()
  } catch {
    /* unsupported — noop */
  }
}

export function onGuestMessage(cb: (msg: GuestBroadcastMessage) => void): Unsubscribe {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return () => {}
  }
  const ch = new BroadcastChannel(CHANNEL)
  const handler = (e: MessageEvent) => {
    cb(e.data as GuestBroadcastMessage)
  }
  ch.addEventListener('message', handler)
  return () => {
    ch.removeEventListener('message', handler)
    ch.close()
  }
}
