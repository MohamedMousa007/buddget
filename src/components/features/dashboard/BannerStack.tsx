'use client'
import type { ReactNode } from 'react'

/**
 * The single floating slot for in-app detection banners.
 *
 * Each banner used to own its own `fixed … top-… z-50` wrapper, which meant a second one
 * landed at IDENTICAL coordinates and covered the first — `space-y-2` only stacks children
 * of one container. Both can fire from a single SMS (a charge can reveal a new account AND
 * an untracked subscription at once), so one of them would have been invisible.
 *
 * Owning the position here makes the banners plain children that genuinely stack, and
 * leaves one place to get the safe-area inset right.
 */
export function BannerStack({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+12px)] z-50 space-y-2 sm:left-auto sm:right-4 sm:w-96">
      {children}
    </div>
  )
}
