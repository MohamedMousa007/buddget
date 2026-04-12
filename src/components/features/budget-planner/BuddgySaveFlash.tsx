'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'

export function BuddgySaveFlash({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show ?
        <motion.div
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-green)] text-white shadow-lg"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 1], opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <Check className="h-7 w-7" strokeWidth={3} />
          </motion.div>
        </motion.div>
      : null}
    </AnimatePresence>
  )
}
