'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { useShallow } from 'zustand/react/shallow'
import { PromptBanner } from '@/components/ui/PromptBanner'
import { PillHint } from '@/components/ui/StatusPill'
import { monoDigits } from '@/lib/ui/monoDigits'
import { usePromptStore, freshPrompt, type Prompt } from '@/lib/store/usePromptStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { isSnoozed, snoozeUntil } from '@/lib/prompts/snooze'
import { usePromptStateSync } from '@/lib/prompts/usePromptStateSync'
import { useT } from '@/lib/i18n'

const EASE = [0.2, 0.8, 0.2, 1] as const
/** Swipe distance or speed that counts as a gesture (px, px/s — 0.5 px/ms). */
const SWIPE_PX = 40
const SWIPE_V = 500
/** Exit offset in px, the same unit as the dragged offset, so the exit continues from where the finger let go. */
const EXIT_Y = -240

function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * The drop-down prompt stack. Every question the app needs answered (a late payday, an
 * income match, SMS to review, a detected account or subscription) registers here via
 * `useRegisterPrompts`; this renders ONE card at the top with up to two peeking behind it.
 *
 * It overlays the page instead of pushing it down: only the card takes pointer events,
 * so the page never shifts and stays usable underneath. ✕ and swipe-up both snooze
 * (3 h, waking hours only); the card moves only upward, and the pager dots pick a card.
 * A prompt resolves when one of its own buttons is used — the source drops it, and the
 * next card slides in.
 */
export function BannerStack() {
  const t = useT()
  const bySource = usePromptStore((s) => s.bySource)
  // Nothing is asked before this account's own data has arrived: a prompt built from an empty store would ask what was already answered.
  const synced = useSettingsStore((s) => s.serverSyncedFor !== null)
  usePromptStateSync()
  const { dismissed, snoozed, snoozeBanner } = useSettingsStore(
    useShallow((s) => ({ dismissed: s.dismissedBanners, snoozed: s.snoozedBanners, snoozeBanner: s.snoozeBanner })),
  )
  const [now, setNow] = useState(() => Date.now())
  const [index, setIndex] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  const prompts = useMemo<Prompt[]>(
    () =>
      (synced ? Object.values(bySource).flat() : [])
        .filter((p) => !dismissed.includes(p.key) && !isSnoozed(snoozed, p.key, now))
        .sort((a, b) => a.priority - b.priority),
    [bySource, dismissed, snoozed, now, synced],
  )

  // A snooze ends on its own: wake at the earliest return time among hidden prompts.
  useEffect(() => {
    const next = Object.values(snoozed)
      .map((iso) => Date.parse(iso))
      .filter((ms) => ms > now)
      .sort((a, b) => a - b)[0]
    if (!next) return
    const id = window.setTimeout(() => setNow(Date.now()), Math.min(next - now + 50, 2 ** 31 - 1))
    return () => window.clearTimeout(id)
  }, [snoozed, now])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2000)
    return () => window.clearTimeout(id)
  }, [toast])

  const count = prompts.length
  const at = count ? Math.min(index, count - 1) : 0
  const front = prompts[at]

  const snooze = (key: string) => {
    const until = snoozeUntil(new Date())
    snoozeBanner(key, until.toISOString())
    setNow(Date.now())
    setToast(t.prompts.snoozedUntil(fmtTime(until)))
  }


  return (
    <div className="w-full">
      <div className="relative">
        {[2, 1]
          .filter((depth) => depth < count)
          .map((depth) => (
            <div
              key={depth}
              aria-hidden
              className="absolute h-10 rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] shadow-[var(--shadow-md)]"
              style={{ insetInline: depth * 10, bottom: -6 * depth, opacity: depth === 1 ? 0.7 : 0.4 }}
            />
          ))}
        <AnimatePresence initial={false} mode="popLayout">
          {front ? (
            <SwipeCard
              key={front.key}
              prompt={front}
              index={at}
              count={count}
              onSnooze={() => snooze(front.key)}
              onSelect={setIndex}
              snoozeLabel={t.prompts.snooze}
              counterLabel={t.prompts.counter(at + 1, count)}
              dotLabel={(i) => t.prompts.counter(i + 1, count)}
            />
          ) : null}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {toast ? (
          <div className="mt-3.5 flex justify-center">
            <PillHint>{monoDigits(toast)}</PillHint>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function SwipeCard({
  prompt,
  index,
  count,
  onSnooze,
  onSelect,
  snoozeLabel,
  counterLabel,
  dotLabel,
}: {
  prompt: Prompt
  index: number
  count: number
  onSnooze: () => void
  onSelect: (i: number) => void
  snoozeLabel: string
  counterLabel: string
  dotLabel: (i: number) => string
}) {
  const y = useMotionValue(0)
  // The card follows the finger and fades toward .5 as it rises.
  const opacity = useTransform(y, [-80, 0], [0.5, 1])
  const Icon = prompt.icon

  // Only upward travel, 1:1 with the finger. A swipe that counts leaves from where the finger let go; a short one springs
  // back here. The old `dragSnapToOrigin` and closed constraints started a spring to 0 on release that the exit then
  // cut off, and a '%' exit target is a different unit from the dragged px offset; either can read as a jerk.
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (-info.offset.y > SWIPE_PX || -info.velocity.y > SWIPE_V) onSnooze()
    else void animate(y, 0, { type: 'spring', stiffness: 500, damping: 40 })
  }

  return (
    <motion.div
      className="pointer-events-auto relative touch-none"
      style={{ y, opacity }}
      initial={{ y: '-120%' }}
      animate={{ y: 0, transition: { duration: 0.32, ease: EASE } }}
      exit={{ y: EXIT_Y, opacity: 0, transition: { duration: 0.2, ease: 'easeOut' } }}
      drag="y"
      dragConstraints={{ bottom: 0 }}
      dragElastic={{ bottom: 0 }}
      dragMomentum={false}
      onDragEnd={onDragEnd}
    >
      <PromptBanner
        variant="overlay"
        icon={<Icon strokeWidth={1.75} />}
        tone={prompt.tone}
        title={prompt.title}
        description={prompt.description}
        actions={prompt.actions.map((a, i) => ({
          label: a.label,
          variant: a.variant,
          // Read the freshest callback: the store keeps only what the card shows.
          onPress: () => (freshPrompt(prompt.key)?.actions[i] ?? a).onPress(),
        }))}
        onSnooze={onSnooze}
        snoozeLabel={snoozeLabel}
        index={index}
        count={count}
        counterLabel={counterLabel}
        onSelectIndex={onSelect}
        dotLabel={dotLabel}
      />
    </motion.div>
  )
}
