'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n'
import { pushToast, toastDuration, type ToastItem } from './toastQueue'

interface ToastOptions {
  undo?: () => void
  undoLabel?: string
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
      role="status"
      aria-live="polite"
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocus={pause}
      onBlur={resume}
      onTouchStart={pause}
      onTouchEnd={resume}
      className={`flex items-center gap-3 rounded-full shadow-lg pointer-events-auto text-sm font-medium ${
        hasUndo
          ? 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] border border-[var(--color-brand-border)] pl-4 pr-1.5 py-1.5'
          : 'bg-[var(--color-brand-green)] text-white px-4 py-2'
      }`}
    >
      {hasUndo ? <span>{item.message}</span> : <span>✓ {item.message}</span>}
      {hasUndo ? (
        <button
          type="button"
          onClick={() => {
            item.undo!()
            onDone(item.id)
          }}
          className="min-h-11 min-w-11 rounded-full bg-[var(--color-brand-primary)] px-4 text-xs font-semibold text-[var(--color-brand-on-primary)] active:opacity-80"
        >
          {item.undoLabel || t.common.undo}
        </button>
      ) : null}
    </div>
  )
}

export function ActionToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const done = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), [])

  const show = useCallback<ShowToast>((message, opts) => {
    setToasts((list) => pushToast(list, { id: nextId++, message, undo: opts?.undo, undoLabel: opts?.undoLabel }))
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toasts.length ? (
        <div data-toast-region className="fixed top-[calc(env(safe-area-inset-top)+1rem)] inset-x-0 z-[var(--z-toast)] flex flex-col items-center gap-2 pointer-events-none px-4">
          {toasts.map((item) => (
            <ToastCard key={item.id} item={item} onDone={done} />
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  )
}
