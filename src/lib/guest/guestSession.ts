/**
 * Guest-session sessionStorage surface. One module owns the raw string keys so
 * `clearBudgetData` + `AuthProvider` + any debug helpers read and write from the
 * same place.
 */

export const GUEST_FLAG_KEY = 'buddget_guest'
export const GUEST_NICKNAME_KEY = 'buddget_guest_nickname'
export const GUEST_NEXT_KEY = 'buddget_guest_next'

export function getGuestFlag(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(GUEST_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

export function setGuestFlag(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (on) window.sessionStorage.setItem(GUEST_FLAG_KEY, '1')
    else window.sessionStorage.removeItem(GUEST_FLAG_KEY)
  } catch {
    /* restricted storage */
  }
}

export function getGuestNickname(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(GUEST_NICKNAME_KEY)
  } catch {
    return null
  }
}

export function setGuestNickname(nickname: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (nickname) window.sessionStorage.setItem(GUEST_NICKNAME_KEY, nickname)
    else window.sessionStorage.removeItem(GUEST_NICKNAME_KEY)
  } catch {
    /* restricted storage */
  }
}

/** Path the guest wanted to reach; consumed + cleared when onboarding completes. */
export function getGuestNext(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.sessionStorage.getItem(GUEST_NEXT_KEY)
    if (!v || !v.startsWith('/') || v.startsWith('//')) return null
    return v
  } catch {
    return null
  }
}

export function setGuestNext(next: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      window.sessionStorage.setItem(GUEST_NEXT_KEY, next)
    } else {
      window.sessionStorage.removeItem(GUEST_NEXT_KEY)
    }
  } catch {
    /* restricted storage */
  }
}

export { setStorageMode } from '@/lib/store/safeLocalStorage'
