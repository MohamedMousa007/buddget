import { BOTTOM_NAV_ITEMS } from './bottomNavConfig'

/** Paths that render a bottom-nav tab's own view (the tab hrefs plus the aliases AppViewRouter maps to the same page). */
export const TAB_ROOTS: ReadonlySet<string> = new Set([
  '/',
  ...BOTTOM_NAV_ITEMS.flatMap((i) => (i.kind === 'link' ? [i.href] : [])),
  '/expenses',
  '/income',
  '/savings',
  '/investment',
])

export function isTabRoot(path: string): boolean {
  return TAB_ROOTS.has(path)
}

export interface BackDeps {
  /** Runs the LIFO back-guard registry; true = a guard consumed the press. */
  runGuards: () => boolean
  modalOpen: boolean
  closeModal: () => void
  /** Some overlay holds the scroll lock but registered no guard. */
  overlayLocked: boolean
  path: string
  canGoBack: boolean
  historyBack: () => void
  navigate: (href: string, opts?: { replace?: boolean }) => void
}

export type BackOutcome = 'guard' | 'modal' | 'blocked' | 'tab-root' | 'history' | 'home' | 'root'

/**
 * The app's one back action, shared by Android hardware/gesture back and the iOS edge swipe.
 * Guards first, then the active modal, then history. Android keeps its rules (root is `/`, which
 * the caller turns into the press-again-to-exit toast); iOS never leaves the app: tab roots stay,
 * and with no history it lands on Flow.
 */
export function goBack(platform: 'android' | 'ios', d: BackDeps): BackOutcome {
  if (d.runGuards()) return 'guard'
  if (d.modalOpen) {
    d.closeModal()
    return 'modal'
  }
  if (platform === 'android') {
    if (d.path === '/') return 'root'
    if (d.canGoBack) d.historyBack()
    else d.navigate('/')
    return d.canGoBack ? 'history' : 'home'
  }
  if (d.overlayLocked) return 'blocked'
  if (isTabRoot(d.path)) return 'tab-root'
  if (d.canGoBack) {
    d.historyBack()
    return 'history'
  }
  d.navigate('/flow', { replace: true })
  return 'home'
}
