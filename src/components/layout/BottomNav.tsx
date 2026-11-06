'use client'

import { AppLink as Link } from '@/components/ui/AppLink'
import { useNavPath } from '@/lib/navigation/navStore'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n'
import { BOTTOM_NAV_ITEMS } from '@/lib/navigation/bottomNavConfig'
import { isTabActive } from '@/lib/navigation/isTabActive'
import { useVoiceHoldGesture } from '@/hooks/useVoiceHoldGesture'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useVoiceExpense } from '@/hooks/useVoiceExpense'
import { VoiceRecordOverlay } from '@/components/voice/VoiceRecordOverlay'
import { useRef } from 'react'

const TAB = 'flex h-16 min-w-14 flex-col items-center justify-center gap-1 transition-colors duration-200'
const TAB_ON = 'font-bold text-[var(--color-brand-primary-ink)]'
const TAB_OFF = 'font-medium text-[var(--color-brand-text-muted)]'

export function BottomNav() {
  const pathname = useNavPath()
  const t = useT()
  const { setActiveModal } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const voice = useVoiceExpense()

  const trashRef = useRef<HTMLDivElement>(null)
  const { handlers: fabHandlers, posX, posY, nearTrash } = useVoiceHoldGesture({
    trashRef,
    onTap: () => {
      setActiveModal('quickAdd')
    },
    onHoldStart: () => {
      requireAuth(() => {
        void voice.start()
      }, t.modals.fabRequireAuth)
    },
    onHoldEnd: () => { void voice.stop() },
    onHoldCancel: () => { void voice.cancel() },
  })

  // The first-run journey is a takeover with its own footer.
  if (pathname === '/start') return null

  return (
    <nav aria-label={t.common.mainNavigation} className="lg:hidden fixed bottom-0 start-0 end-0 z-50 bg-[var(--color-brand-card)] border-t border-[var(--color-brand-border)] safe-area-bottom">
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
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        {BOTTOM_NAV_ITEMS.map((item) => {
          if (item.kind === 'fab') {
            return (
              <div key="fab" className="flex justify-center" style={{ touchAction: 'none' }}>
                <button data-raw-button-ok="the centre FAB: one raised 54px circle, not a button style"
                  type="button"
                  {...fabHandlers}
                  // Pointer taps open it through the hold gesture; a keyboard or screen-reader activation arrives as a click with
                  // no pointer (detail 0) and would otherwise do nothing.
                  onClick={(e) => { if (e.detail === 0) setActiveModal('quickAdd') }}
                  style={{ touchAction: 'none' }}
                  className="flex items-center justify-center h-[54px] w-[54px] -mt-[26px] rounded-[18px] bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] text-[var(--color-brand-on-primary)] shadow-[0_0_0_4px_var(--color-brand-card),var(--shadow-md)] transition-[colors,transform] duration-[75ms] active:scale-[0.92] touch-none select-none"
                  aria-label={t.nav.quickAdd}
                >
                  <item.icon className="size-[26px]" strokeWidth={2.25} />
                </button>
              </div>
            )
          }

          const isActive = isTabActive(pathname, item.href)
          return (
            <div key={item.href} className="flex justify-center">
              <Link href={item.href} aria-current={isActive ? 'page' : undefined} className={cn(TAB, isActive ? TAB_ON : TAB_OFF)}>
                <item.icon className={cn('size-6', isActive && 'text-[var(--color-brand-primary)]')} strokeWidth={1.75} />
                <span className="text-[0.65625rem]">{t.nav[item.label as keyof Dictionary['nav']]}</span>
              </Link>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
