'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n'
import { pushToast, toastDuration, type ToastItem } from './toastQueue'
import { Button } from './button'

interface ToastOptions {
  undo?: () => void
  undoLabel?: string
  tone?: ToastItem['tone']
}

type ShowToast = (msg: string, opts?: ToastOptions) => void

const ToastContext = createContext<ShowToast>(() => {})

export function useActionToast() {
  return useContext(ToastContext)
}

let nextId = 1

function ToastCard({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const t = useT()
  const hasUndo = !!item.undo
  const remaining = useRef(toastDuration(hasUndo))
  const startedAt = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const running = useRef(false)

  const resume = useCallback(() => {
    if (running.current) return
    running.current = true
    window.clearTimeout(timer.current)
    startedAt.current = Date.now()
    timer.current = window.setTimeout(() => onDone(item.id), remaining.current)
  }, [item.id, onDone])

  const pause = useCallback(() => {
    if (!running.current) return
    running.current = false
    window.clearTimeout(timer.current)
    remaining.current = Math.max(1500, remaining.current - (Date.now() - startedAt.current))
  }, [])

  useEffect(() => {
    resume()
    return () => {
      running.current = false
      window.clearTimeout(timer.current)
    }
  }, [resume])

  return (
    <div
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocus={pause}
      onBlur={resume}
      onTouchStart={pause}
      onTouchEnd={resume}
      className={`flex items-center gap-3 rounded-full shadow-lg pointer-events-auto text-sm font-medium ${
        hasUndo
          ? 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] border border-[var(--color-brand-border)] ps-4 pe-1.5 py-1.5'
          : item.tone === 'warning'
            ? 'border border-[color-mix(in_oklab,var(--color-brand-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--color-brand-amber)_18%,var(--color-brand-card))] text-[var(--color-brand-text-primary)] px-4 py-2'
            : 'bg-[var(--color-brand-green)] text-[var(--color-brand-on-green)] px-4 py-2'
      }`}
    >
      {hasUndo || item.tone === 'warning' ? <span>{item.message}</span> : <span><span aria-hidden>✓ </span>{item.message}</span>}
      {hasUndo ? (
        <Button
          size="sm"
          className="rounded-full px-4"
          onClick={() => {
            item.undo!()
            onDone(item.id)
          }}
        >
          {item.undoLabel || t.common.undo}
        </Button>
      ) : null}
    </div>
  )
}

export function ActionToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const done = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), [])

  const show = useCallback<ShowToast>((message, opts) => {
    setToasts((list) => pushToast(list, { id: nextId++, message, undo: opts?.undo, undoLabel: opts?.undoLabel, tone: opts?.tone }))
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* One live region that is always mounted: screen readers only announce text added to a region that already exists. */}
      <div data-toast-region role="status" aria-live="polite" className="fixed top-[calc(env(safe-area-inset-top)+1rem+var(--top-notices-h,0px))] inset-x-0 transition-[top] duration-200 z-[var(--z-toast)] flex flex-col items-center gap-2 pointer-events-none px-4">
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDone={done} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
