'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Fingerprint, Loader2, ScanFace } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-context'
import { authenticate, getType, type BiometryType } from '@/lib/native/biometricAuth'
import { useT } from '@/lib/i18n'

/**
 * Full-screen biometric lock. Shown at launch when the SDK holds a session and
 * the user enabled biometric login. Unlocking reveals the live session the SDK
 * already owns — nothing is replayed, so refresh-token reuse can never fire.
 * If the SDK's session was revoked server-side, `unlock()` returns false and we
 * drop the user to a full sign-out + email.
 */
export function LockScreen() {
  const t = useT()
  const { unlock, signOut } = useAuth()
  const [type, setType] = useState<BiometryType>(null)
  const [busy, setBusy] = useState(false)
  const [expired, setExpired] = useState(false)
  const busyRef = useRef(false)
  const autoRan = useRef(false)

  const reason = t.settings.biometricConfirmReason

  const run = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    let authed = false
    try {
      await authenticate(reason)
      authed = true
    } catch {
      // Cancel / dismiss / failed prompt — leave the button for a retry.
    }
    if (!authed) {
      busyRef.current = false
      setBusy(false)
      return
    }
    const ok = await unlock()
    busyRef.current = false
    setBusy(false)
    // Session gone server-side (revoked/expired) — no way back but a fresh login.
    if (!ok) setExpired(true)
  }, [unlock, reason])

  useEffect(() => {
    void getType().then(setType)
  }, [])

  // Auto-prompt once on mount so the fingerprint sheet appears without a tap.
  // Deferred a tick so the state updates inside run() don't fire synchronously
  // in the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (autoRan.current) return
    autoRan.current = true
    const id = setTimeout(() => void run(), 0)
    return () => clearTimeout(id)
  }, [run])

  const Icon = type === 'face' ? ScanFace : Fingerprint
  const label = type === 'face' ? t.auth.biometricSignInFace : t.auth.biometricSignInFingerprint

  return (
    <div className="dark lg-bg min-h-[100svh] relative flex flex-col items-center justify-center px-6 text-center">
      <style>{`
        .lg-bg {
          background:
            radial-gradient(120% 60% at 50% -6%, rgba(229,9,20,.26) 0%, rgba(229,9,20,.06) 38%, rgba(20,18,26,0) 62%),
            linear-gradient(180deg, #1A1720 0%, #121016 55%, #0E0C12 100%) !important;
        }
      `}</style>

      <h1
        className="text-4xl font-extrabold tracking-tight"
        style={{ fontFamily: 'var(--font-heading), var(--font-sans)' }}
      >
        <span className="text-[var(--color-brand-text-primary)]">Bud</span>
        <span className="text-[var(--color-brand-red)]">d</span>
        <span className="text-[var(--color-brand-text-primary)]">get</span>
      </h1>

      {expired ? (
        <>
          <p className="mt-3 max-w-xs text-sm text-[var(--color-brand-text-muted)]">
            {t.auth.sessionExpired}
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-8 flex h-12 items-center justify-center rounded-xl bg-[var(--color-brand-red)] px-6 font-medium text-white"
          >
            {t.common.signIn}
          </button>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-[var(--color-brand-text-muted)]">{t.brand.tagline}</p>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            aria-label={label}
            className="mt-10 flex h-20 w-20 items-center justify-center rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-primary)] transition-colors hover:bg-[var(--color-brand-elevated)] disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            ) : (
              <Icon className="h-8 w-8" aria-hidden />
            )}
          </button>
          <p className="mt-4 text-sm text-[var(--color-brand-text-secondary)]">{label}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="absolute bottom-[max(env(safe-area-inset-bottom),2rem)] text-sm text-[var(--color-brand-text-muted)] underline-offset-4 hover:underline"
          >
            {t.common.signOut}
          </button>
        </>
      )}
    </div>
  )
}
