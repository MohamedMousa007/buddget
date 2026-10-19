'use client'

import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthOtpRow } from '@/components/features/auth-modal/AuthOtpRow'
import { Notice } from '../ui/Panel'
import { adminPost, errorMessage } from '../adminClient'

const RESEND_SECONDS = 60

/**
 * The emailed 6-digit code, the same one the app uses to sign in. `alreadySent` is for flows whose previous step
 * already mailed it. Reuses the app's OTP row and its resend wording.
 */
export function EmailCodeInput({ value, onChange, email, alreadySent = false, disabled = false }: { value: string; onChange: (code: string) => void; email?: string; alreadySent?: boolean; disabled?: boolean }) {
  const [sent, setSent] = useState(alreadySent)
  const [cooldown, setCooldown] = useState(alreadySent ? RESEND_SECONDS : 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      await adminPost('/api/admin/auth/code', {})
      setSent(true)
      setCooldown(RESEND_SECONDS)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {sent ? (
        <>
          <p className="text-center text-sm text-[var(--color-brand-text-secondary)]">We sent a 6-digit code{email ? ` to ${email}` : ' to your email'}.</p>
          <AuthOtpRow value={value} onChange={onChange} disabled={disabled} />
          <div className="flex justify-center">
            <Button type="button" variant="link" size="sm" disabled={cooldown > 0 || busy} onClick={() => void send()} className="no-underline hover:underline disabled:cursor-not-allowed">
              {cooldown > 0 ? `Send a new code (${cooldown}s)` : 'Send a new code'}
            </Button>
          </div>
        </>
      ) : (
        <Button type="button" variant="outline" size="cta-block" loading={busy} disabled={disabled} onClick={() => void send()}><Mail />Email me a code</Button>
      )}
      {error ? <Notice tone="negative">{error}</Notice> : null}
    </div>
  )
}
