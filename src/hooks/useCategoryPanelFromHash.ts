'use client'

import { useCallback, useSyncExternalStore } from 'react'

export type CategoryBudgetPanel = 'spending' | 'budget'

const hashSubscribers = new Set<() => void>()

function readPanelFromLocation(): CategoryBudgetPanel {
  if (typeof window === 'undefined') return 'spending'
  return window.location.hash === '#budget' ? 'budget' : 'spending'
}

function subscribeToHash(onChange: () => void) {
  hashSubscribers.add(onChange)
  const onHash = () => onChange()
  window.addEventListener('hashchange', onHash)
  return () => {
    window.removeEventListener('hashchange', onHash)
    hashSubscribers.delete(onChange)
  }
}

/** `history.replaceState` to clear `#budget` does not emit `hashchange`; call this after mutating the URL. */
function notifyHashSubscribers() {
  hashSubscribers.forEach((cb) => cb())
}

/**
 * Home category card: panel follows `/#budget` and stays in sync with back/forward and in-app hash updates.
 */
export function useCategoryPanelFromHash() {
  const panel = useSyncExternalStore(
    subscribeToHash,
    readPanelFromLocation,
    (): CategoryBudgetPanel => 'spending'
  )

  const selectSpending = useCallback(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
      notifyHashSubscribers()
    }
  }, [])

  const selectBudget = useCallback(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash !== '#budget') {
      window.location.hash = '#budget'
    }
  }, [])

  return { panel, selectSpending, selectBudget }
}
