'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'
import { useT } from '@/lib/i18n'

const MIN = 8

export default function ResetPasswordConfirmPage() {
  const router = useRouter()
  const t = useT()
  const supabase = useMemo(() => createClient(), [])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (!cancelled && data.session) setChecking(false)
    })()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setChecking(false)
    })
    const t = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          router.replace('/?error=reset')
          return
        }
        setChecking(false)
      })()
    }, 8000)
    return () => {
      cancelled = true
      subscription.unsubscribe()
      window.clearTimeout(t)
    }
  }, [supabase, router])

  const submit = async () => {
    setError('')
    if (password.length < MIN) {
      setError(t.resetPassword.errorMinLength(MIN))
      return
    }
    if (password !== confirm) {
      setError(t.resetPassword.errorMismatch)
      return
    }
    setLoading(true)
    const { error: e } = await supabase.auth.updateUser({ password })
    if (e) {
      setLoading(false)
      setError(t.resetPassword.errorUpdateFailed)
      return
    }
    try {
      clearBudgetData()
    } catch (e) {
      console.error('[reset-password] clearBudgetData failed', e)
    }
    const { error: signOutError } = await supabase.auth.signOut()
    setLoading(false)
    if (signOutError) {
      setError(t.resetPassword.errorUpdateFailed)
      return
    }
    router.replace('/?passwordUpdated=1')
    router.refresh()
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F]">
        <Loader2 className="w-8 h-8 animate-spin text-[#E50914]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A0A0F]">
      <div
        className="w-full max-w-md border p-8 rounded-2xl space-y-4"
        style={{ background: '#111118', borderColor: '#2A2A38' }}
      >
        <h1 className="text-xl font-bold text-white text-center">{t.resetPassword.title}</h1>
        <p className="text-sm text-[#5A5A72] text-center">{t.resetPassword.subtitle}</p>
        <div className="space-y-2">
          <label className="text-xs text-[#5A5A72]">{t.resetPassword.labelNew}</label>
          <div className="relative">
            <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A72]" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.resetPassword.placeholderNew}
              className="w-full h-12 ps-10 pe-3 rounded-[10px] border border-[#2A2A38] bg-[#1A1A24] text-white outline-none focus:border-[#E50914]"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-[#5A5A72]">{t.resetPassword.labelConfirm}</label>
          <div className="relative">
            <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A72]" />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder={t.resetPassword.placeholderConfirm}
              className="w-full h-12 ps-10 pe-3 rounded-[10px] border border-[#2A2A38] bg-[#1A1A24] text-white outline-none focus:border-[#E50914]"
            />
          </div>
        </div>
        {error ? <p className="text-sm text-[#E50914]">{error}</p> : null}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading}
          className="w-full h-12 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: '#E50914' }}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t.resetPassword.buttonSubmit}
        </button>
      </div>
    </div>
  )
}
