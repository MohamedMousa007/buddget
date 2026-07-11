'use client'

import { useEffect, useRef, useState } from 'react'
import { useScrollLock } from '@/lib/ui/scrollLock'
import { registerBackGuard } from '@/lib/navigation/backGuard'

export function useBottomNavMoreSheet() {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreWrapRef = useRef<HTMLDivElement>(null)

  // Ref-counted so it composes with any modal open behind the More sheet
  // (the old `= ''` restore clobbered a still-open modal's lock).
  useScrollLock(moreOpen)

  // Hardware/gesture back closes the sheet first (returns true = handled) so it
  // doesn't fall through to app navigation and disturb the page behind it.
  useEffect(() => {
    if (!moreOpen) return
    return registerBackGuard(() => { setMoreOpen(false); return true })
  }, [moreOpen])

  useEffect(() => {
    if (!moreOpen) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = moreWrapRef.current
      if (el && !el.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [moreOpen])

  return { moreOpen, setMoreOpen, moreWrapRef }
}
