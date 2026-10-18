'use client'

import { useEffect, useRef } from 'react'
import { Minus, Plus } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'
import { useT } from '@/lib/i18n'
import { addMonthsIso, monthsUntil } from '@/lib/goals/goalPlan'

/** The primary control of step 2: target month with 44px minus/plus (hold to repeat) and a month picker. */
export function DateStepper({ value, now, onChange }: { value: string; now: Date; onChange: (iso: string) => void }) {
  const t = useT().goals.flow.s2
  const months = monthsUntil(now, value)
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])

  const move = (dir: 1 | -1) => {
    const next = addMonthsIso(now, Math.max(1, monthsUntil(now, valueRef.current) + dir))
    valueRef.current = next
    onChange(next)
  }
  const hold = (dir: 1 | -1) => {
    stop()
    move(dir)
    let delay = 420
    const tick = () => {
      move(dir)
      delay = Math.max(70, delay * 0.8)
      timer.current = setTimeout(tick, delay)
    }
    timer.current = setTimeout(tick, delay)
  }
  const press = (dir: 1 | -1) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      hold(dir)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        move(dir)
      }
    },
  })

  return (
    <div className="flex min-h-14 items-center gap-2 rounded-[14px] border-[1.5px] border-[var(--color-brand-primary)] bg-[var(--color-brand-elevated)] ps-3 pe-1.5">
      <div className="min-w-0 flex-1">
        <MonthYearPicker compact monthFilter={value.slice(0, 7)} onChange={(m) => onChange(`${m}-01`)} />
        <p className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">{t.monthsAway(months)}</p>
      </div>
      <IconButton variant="outlined" aria-label={t.earlier} disabled={months <= 1} {...press(-1)}>
        <Minus />
      </IconButton>
      <IconButton variant="outlined" aria-label={t.later} {...press(1)}>
        <Plus />
      </IconButton>
    </div>
  )
}
