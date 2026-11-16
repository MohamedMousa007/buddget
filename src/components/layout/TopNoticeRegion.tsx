'use client'

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'

// The status slot element, handed over by the region's ref; pills subscribe to it.
let statusSlot: HTMLElement | null = null
const listeners = new Set<() => void>()
const setStatusSlot = (el: HTMLDivElement | null) => {
  statusSlot = el
  listeners.forEach((l) => l())
}

/**
 * The one area under the status bar: status pills first, then the prompt card (children). Each used to own its own fixed
 * layer at the same spot, so a pill covered a card and a toast landed on both. Its height is published as
 * `--top-notices-h` so toasts sit below whatever is showing.
 */
export function TopNoticeRegion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const ro = new ResizeObserver(() => root.style.setProperty('--top-notices-h', `${el.offsetHeight}px`))
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--top-notices-h')
    }
  }, [])
  return (
    <div
      ref={ref}
      data-inert-exempt
      className="pointer-events-none fixed inset-x-2.5 top-[calc(env(safe-area-inset-top,0px)+3px)] z-[58] mx-auto flex max-w-[620px] flex-col items-center gap-2 lg:start-[calc(var(--sidebar-w)+0.625rem)] lg:top-[calc(var(--app-header-h-lg)+8px)]"
    >
      <div ref={setStatusSlot} className="flex flex-col items-center gap-2 empty:hidden" />
      <div className="w-full empty:hidden">{children}</div>
    </div>
  )
}

/** The status slot once the region is mounted; null outside the app shell (the pill then places itself). */
export function useStatusSlot(): HTMLElement | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => statusSlot,
    () => null,
  )
}
