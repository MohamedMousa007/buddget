'use client'

import { AnimatePresence } from 'framer-motion'
import { UpdateToast } from '@/components/ui/UpdateToast'
import { usePwaUpdateAvailable } from '@/hooks/usePwaUpdateAvailable'

export function PwaUpdateNotifier() {
  const { updateReady, refreshNow } = usePwaUpdateAvailable()

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center pb-6 sm:pb-8"
      aria-hidden={!updateReady}
    >
      <AnimatePresence mode="wait">
        {updateReady ? <UpdateToast key="pwa-update" onRefresh={refreshNow} /> : null}
      </AnimatePresence>
    </div>
  )
}
