'use client'

import { AppLink as Link } from '@/components/ui/AppLink'
import { useNavPath } from '@/lib/navigation/navStore'
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

/** Routes that light the Flow tab: Flow itself, its old Expenses/Income aliases and Paydays. */
const FLOW_PATHS = new Set(['/flow', '/expenses', '/income', '/paydays'])
const TAB = 'flex h-16 min-w-14 flex-col items-center justify-center gap-1 transition-colors duration-200'
const TAB_ON = 'font-bold text-[var(--color-brand-primary-ink)]'
const TAB_OFF = 'font-medium text-[var(--color-brand-text-muted)]'

export function BottomNav() {
  const pathname = useNavPath()
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
    <nav className="lg:hidden fixed bottom-0 start-0 end-0 z-50 bg-[var(--color-brand-card)] border-t border-[var(--color-brand-border)] safe-area-bottom">
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
      <div className="grid h-16 grid-cols-5 items-center">
        {BOTTOM_NAV_ITEMS.map((item) => {
          if (item.kind === 'fab') {
            return (
              <div key="fab" className="flex justify-center" style={{ touchAction: 'none' }}>
                <button data-raw-button-ok="the centre FAB: one raised 54px circle, not a button style"
                  type="button"
                  {...fabHandlers}
                  style={{ touchAction: 'none' }}
                  className="flex items-center justify-center h-[54px] w-[54px] -mt-[26px] rounded-[18px] bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] text-[var(--color-brand-on-primary)] shadow-[0_0_0_4px_var(--color-brand-card),var(--shadow-md)] transition-[colors,transform] duration-[75ms] active:scale-[0.92] touch-none select-none"
                  aria-label={t.nav.quickAdd}
                >
                  <item.icon className="size-[26px]" strokeWidth={2.25} />
                </button>
              </div>
            )
          }

          if (item.kind === 'more') {
            return (
              <div key="more" ref={moreWrapRef} className="flex flex-col items-center">
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
                    <BottomNavMorePanel key="more-panel" pathname={pathname} items={BOTTOM_NAV_MORE_MENU} onNavigate={closeMore} onClose={closeMore} />
                  ) : null}
                </AnimatePresence>
                <button
                  data-raw-button-ok="a bottom-nav tab: same box as its sibling link tabs"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMoreOpen((v) => !v)
                  }}
                  className={cn(TAB, moreOpen || moreActive ? TAB_ON : TAB_OFF)}
                  aria-expanded={moreOpen}
                  aria-haspopup="true"
                >
                  <item.icon className="size-6" strokeWidth={1.75} />
                  <span className="text-[10.5px]">{t.nav[item.label as keyof Dictionary['nav']]}</span>
                </button>
              </div>
            )
          }

          const isActive = item.href === '/flow' ? FLOW_PATHS.has(pathname) : pathname === item.href
          return (
            <div key={item.href} className="flex justify-center">
              <Link href={item.href} onClick={closeMore} className={cn(TAB, isActive ? TAB_ON : TAB_OFF)}>
                <item.icon className={cn('size-6', isActive && 'text-[var(--color-brand-primary)]')} strokeWidth={1.75} />
                <span className="text-[10.5px]">{t.nav[item.label as keyof Dictionary['nav']]}</span>
              </Link>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
