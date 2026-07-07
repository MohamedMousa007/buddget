'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface ToastOptions {
  undo?: () => void
  undoLabel?: string
}

type ShowToast = (msg: string, opts?: ToastOptions) => void

const ToastContext = createContext<ShowToast>(() => {})

export function useActionToast() {
  return useContext(ToastContext)
}

interface ToastState {
  message: string
  undo?: () => void
  undoLabel?: string
}

export function ActionToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current)
    setToast(null)
  }, [])

  const show = useCallback<ShowToast>((message, opts) => {
    window.clearTimeout(timer.current)
    setToast({ message, undo: opts?.undo, undoLabel: opts?.undoLabel })
    timer.current = window.setTimeout(() => setToast(null), opts?.undo ? 5000 : 2000)
  }, [])

  const hasUndo = !!toast?.undo

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <div className="fixed top-[calc(env(safe-area-inset-top)+1rem)] inset-x-0 z-[100] flex justify-center pointer-events-none px-4">
          <div
            role="status"
            aria-live="polite"
            className={`flex items-center gap-3 rounded-full shadow-lg pointer-events-auto text-sm font-medium ${
              hasUndo
                ? 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] border border-[var(--color-brand-border)] pl-4 pr-1.5 py-1.5'
                : 'bg-[var(--color-brand-green)] text-white px-4 py-2'
            }`}
          >
            <span>{hasUndo ? toast.message : `✓ ${toast.message}`}</span>
            {hasUndo ? (
              <button
                type="button"
                onClick={() => {
                  toast!.undo!()
                  dismiss()
                }}
                className="min-h-9 rounded-full bg-[var(--color-brand-red)] px-3 text-xs font-semibold text-white active:opacity-80"
              >
                {toast.undoLabel || 'Undo'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  )
}
