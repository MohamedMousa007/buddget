'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AdminSheet } from './AdminSheet'

type Ask = (reason: string) => Promise<string | null>
const StepUpContext = createContext<Ask | null>(null)

/** Dangerous actions ask for a fresh authenticator code even inside an unlocked session. */
export function useStepUp(): Ask {
  const ask = useContext(StepUpContext)
  if (!ask) throw new Error('useStepUp must be used inside StepUpProvider')
  return ask
}

export function StepUpProvider({ children }: { children: ReactNode }) {
  const [reason, setReason] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const resolver = useRef<((code: string | null) => void) | null>(null)

  const ask = useCallback<Ask>((why) => {
    setCode('')
    setReason(why)
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = (value: string | null) => {
    resolver.current?.(value)
    resolver.current = null
    setReason(null)
  }

  return (
    <StepUpContext.Provider value={ask}>
      {children}
      <AdminSheet open={reason !== null} title="Confirm it’s you" onClose={() => settle(null)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (code.trim()) settle(code.trim())
          }}
        >
          <p className="flex items-start gap-2 text-sm text-[var(--color-brand-text-secondary)]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--color-brand-primary-ink)]" aria-hidden />
            {reason}
          </p>
          <Input size="brand" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="6-digit authenticator code" value={code} onChange={(e) => setCode(e.target.value)} className="text-center font-mono-numbers tracking-[0.3em]" />
          <Button type="submit" size="cta-block" disabled={!code.trim()}>Confirm</Button>
        </form>
      </AdminSheet>
    </StepUpContext.Provider>
  )
}
