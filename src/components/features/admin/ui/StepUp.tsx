'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmailCodeInput } from '../auth/EmailCodeInput'
import { AdminSheet } from './AdminSheet'

/** What the server's `stepUp` accepts: a fresh emailed code or the admin password. Spread it into the request body. */
export type StepUpProof = { code: string } | { stepUpPassword: string }
type Ask = (reason: string) => Promise<StepUpProof | null>
const StepUpContext = createContext<Ask | null>(null)

/** Dangerous actions re-ask for an emailed code (or the admin password) even inside an unlocked session. */
export function useStepUp(): Ask {
  const ask = useContext(StepUpContext)
  if (!ask) throw new Error('useStepUp must be used inside StepUpProvider')
  return ask
}

export function StepUpProvider({ children }: { children: ReactNode }) {
  const [reason, setReason] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const resolver = useRef<((proof: StepUpProof | null) => void) | null>(null)

  const ask = useCallback<Ask>((why) => {
    setCode('')
    setPassword('')
    setUsePassword(false)
    setReason(why)
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = (value: StepUpProof | null) => {
    resolver.current?.(value)
    resolver.current = null
    setReason(null)
  }

  const ready = usePassword ? password.length > 0 : code.replace(/\D/g, '').length === 6

  return (
    <StepUpContext.Provider value={ask}>
      {children}
      <AdminSheet open={reason !== null} title="Confirm it’s you" onClose={() => settle(null)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (ready) settle(usePassword ? { stepUpPassword: password } : { code: code.replace(/\D/g, '') })
          }}
        >
          <p className="flex items-start gap-2 text-sm text-[var(--color-brand-text-secondary)]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--color-brand-primary-ink)]" aria-hidden />
            {reason}
          </p>
          {usePassword ? (
            <Input size="brand" type="password" autoComplete="current-password" autoFocus placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} />
          ) : (
            <EmailCodeInput value={code} onChange={setCode} />
          )}
          <Button type="submit" size="cta-block" disabled={!ready}>Confirm</Button>
          <Button type="button" variant="ghost" size="touch" className="w-full" onClick={() => setUsePassword((v) => !v)}>
            {usePassword ? 'Email me a code instead' : 'Use my admin password instead'}
          </Button>
        </form>
      </AdminSheet>
    </StepUpContext.Provider>
  )
}
