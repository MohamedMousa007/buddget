'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n'
import {
  BOTTOM_NAV_ITEMS,
  BOTTOM_NAV_MORE_MENU,
  BOTTOM_NAV_MORE_HREFS,
} from '@/lib/navigation/bottomNavConfig'
import { useBottomNavMoreSheet } from '@/hooks/useBottomNavMoreSheet'
import { BottomNavMorePanel } from '@/components/features/layout/BottomNavMorePanel'
import { useVoiceHoldGesture } from '@/hooks/useVoiceHoldGesture'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useVoiceExpense } from '@/hooks/useVoiceExpense'
import { VoiceRecordOverlay } from '@/components/voice/VoiceRecordOverlay'
import { useRef } from 'react'

export function BottomNav() {
  const pathname = usePathname()
  const t = useT()
  const { setActiveModal } = useSettingsStore()
  const { moreOpen, setMoreOpen, moreWrapRef } = useBottomNavMoreSheet()
  const moreActive = BOTTOM_NAV_MORE_HREFS.has(pathname)
  const requireAuth = useRequireAuthAction()
  const voice = useVoiceExpense()

  const closeMore = () => setMoreOpen(false)

  const trashRef = useRef<HTMLDivElement>(null)
  const { handlers: fabHandlers, posX, posY, nearTrash } = useVoiceHoldGesture({
    trashRef,
    onTap: () => {
      closeMore()
      setActiveModal('quickAdd')
    },
    onHoldStart: () => {
      requireAuth(() => {
        closeMore()
        void voice.start()
      }, t.modals.fabRequireAuth)
    },
    onHoldEnd: () => { void voice.stop() },
    onHoldCancel: () => { void voice.cancel() },
  })

  return (
    <nav className="lg:hidden fixed bottom-0 start-0 end-0 z-50 bg-[var(--color-brand-card)] border-t border-[var(--color-brand-border)] shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.6)] safe-area-bottom">
      <VoiceRecordOverlay
        state={voice.state}
        amplitude={voice.amplitude}
        animTime={voice.animTime}
        response={voice.response}
        draftActions={voice.draftActions}
        itemErrors={voice.itemErrors}
        transcript={voice.transcript}
        error={voice.error}
        posX={posX}
        posY={posY}
        nearTrash={nearTrash}
        trashRef={trashRef}
        onCancel={() => { void voice.cancel() }}
        onConfirm={() => { voice.confirm() }}
        onUpdateField={voice.updateDraftField}
        onRemove={voice.removeDraftAction}
        onRedo={voice.reset}
        onClose={voice.reset}
        onOpenChat={voice.openInChat}
      />
      <div className="flex items-start justify-between h-16 px-[14px] pt-2">
        {BOTTOM_NAV_ITEMS.map((item) => {
          if (item.kind === 'fab') {
            return (
              <div key="fab" className="flex-1 flex justify-center" style={{ touchAction: 'none' }}>
                <button
                  type="button"
                  {...fabHandlers}
                  style={{ touchAction: 'none' }}
                  className="flex items-center justify-center w-14 h-14 -mt-5 rounded-full bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white shadow-[0_8px_20px_rgba(127,6,12,0.5)] transition-[colors,transform] duration-[75ms] active:scale-[0.92] touch-none select-none"
                  aria-label={t.nav.quickAdd}
                >
                  <item.icon className="w-[26px] h-[26px]" strokeWidth={2.4} />
                </button>
              </div>
            )
          }

          if (item.kind === 'more') {
            return (
              <div key="more" ref={moreWrapRef} className="flex-1 flex flex-col items-center">
                <AnimatePresence>
                  {moreOpen ? (
                    <motion.div
                      key="more-backdrop"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-[2px]"
                      aria-hidden
                      onClick={closeMore}
                    />
                  ) : null}
                  {moreOpen ? (
                    <BottomNavMorePanel key="more-panel" pathname={pathname} items={BOTTOM_NAV_MORE_MENU} onNavigate={closeMore} />
                  ) : null}
                </AnimatePresence>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMoreOpen((v) => !v)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1 py-1 transition-colors duration-200',
                    moreOpen || moreActive
                      ? 'text-[var(--color-brand-red)]'
                      : 'text-[var(--color-brand-text-muted)]'
                  )}
                  aria-expanded={moreOpen}
                  aria-haspopup="true"
                >
                  <item.icon className="w-[23px] h-[23px]" />
                  <span className="text-[10.5px] font-semibold">{t.nav[item.label as keyof Dictionary['nav']]}</span>
                </button>
              </div>
            )
          }

          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMore}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-1 transition-colors duration-200',
                isActive ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-muted)]'
              )}
            >
              <item.icon className="w-[23px] h-[23px]" />
              <span className="text-[10.5px] font-semibold">{t.nav[item.label as keyof Dictionary['nav']]}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
