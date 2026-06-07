'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, Plus, X } from 'lucide-react'
import { isNative, isAndroid } from '@/lib/native/isNative'
import { checkSmsPermission, requestSmsPermission, startSMSTracking } from '@/lib/native/smsTracker'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useShallow } from 'zustand/react/shallow'
import type { TokenInfo } from '@/hooks/useSmsTracking'

interface Props {
  tokenInfo: TokenInfo | null
}

export function SmsAndroidSetupCard({ tokenInfo: _tokenInfo }: Props) {
  const onNative = isNative() && isAndroid()
  const [granted, setGranted] = useState<boolean | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [accessToken, setAccessToken] = useState('')

  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient().auth.getSession().then(({ data }) => {
        setAccessToken(data.session?.access_token ?? '')
      })
    })
  }, [])

  const { customSmsKeywords, updateSettings } = useFinanceStore(
    useShallow((s) => ({
      customSmsKeywords: s.settings.customSmsKeywords ?? [],
      updateSettings: s.updateSettings,
    }))
  )

  useEffect(() => {
    if (!onNative) return
    checkSmsPermission().then(setGranted)
  }, [onNative])

  const handleGrant = useCallback(async () => {
    setRequesting(true)
    try {
      const ok = await requestSmsPermission()
      setGranted(ok)
      if (ok) await startSMSTracking(accessToken)
    } finally {
      setRequesting(false)
    }
  }, [accessToken])

  const addKeyword = useCallback(() => {
    const kw = newKeyword.trim()
    if (!kw || customSmsKeywords.includes(kw)) return
    updateSettings({ customSmsKeywords: [...customSmsKeywords, kw] })
    setNewKeyword('')
  }, [newKeyword, customSmsKeywords, updateSettings])

  const removeKeyword = useCallback((kw: string) => {
    updateSettings({ customSmsKeywords: customSmsKeywords.filter((k) => k !== kw) })
  }, [customSmsKeywords, updateSettings])

  if (!onNative) return null

  if (granted === null) {
    return <p className="text-xs text-[var(--color-brand-text-muted)]">Checking permission…</p>
  }

  if (granted === false) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-[var(--color-brand-text-muted)]">
          Buddget needs SMS access to automatically detect incoming bank transactions.
          No SMS content is stored — only the parsed amount and merchant are forwarded.
        </p>
        <button
          type="button"
          disabled={requesting}
          onClick={() => void handleGrant()}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-green)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {requesting ? 'Requesting…' : 'Grant SMS Access'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[var(--color-brand-green)]" />
        <span className="text-xs font-medium text-[var(--color-brand-green)]">
          Active — listening for bank SMS
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-brand-text-muted)]">
          Custom trigger keywords
        </p>
        <div className="flex flex-wrap gap-1.5">
          {customSmsKeywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] px-2 py-0.5 text-xs text-[var(--color-brand-text-primary)]"
            >
              {kw}
              <button
                type="button"
                onClick={() => removeKeyword(kw)}
                aria-label={`Remove ${kw}`}
              >
                <X className="h-3 w-3 text-[var(--color-brand-text-muted)]" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            placeholder="e.g. Vodafone Cash"
            className="flex-1 rounded-lg border border-[var(--color-brand-border)] bg-transparent px-2.5 py-1 text-xs text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none focus:border-[var(--color-brand-green)]"
          />
          <button
            type="button"
            onClick={addKeyword}
            className="rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] px-2.5 py-1 text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
