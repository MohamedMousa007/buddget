/**
 * Guest-session sessionStorage surface. One module owns the raw string keys so
 * `clearBudgetData` + `AuthProvider` + any debug helpers read and write from the
 * same place.
 */

export const GUEST_FLAG_KEY = 'buddget_guest'
export const GUEST_NICKNAME_KEY = 'buddget_guest_nickname'

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

export { setStorageMode } from '@/lib/store/safeLocalStorage'
