'use client'

import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext<(msg: string) => void>(() => {})

export function useActionToast() {
  return useContext(ToastContext)
}

export function ActionToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)

  const show = useCallback((msg: string) => {
    setMessage(msg)
    window.setTimeout(() => setMessage(null), 2000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <div className="fixed bottom-20 inset-x-0 z-[100] flex justify-center pointer-events-none px-4">
          <div
            role="status"
            aria-live="polite"
            className="bg-[var(--color-brand-green)] text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg pointer-events-auto"
          >
            ✓ {message}
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  )
}
