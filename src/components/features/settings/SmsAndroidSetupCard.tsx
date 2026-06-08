'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, ChevronDown, Plus, X, AlertTriangle } from 'lucide-react'
import { isNative, isAndroid } from '@/lib/native/isNative'
import { checkSmsPermission, syncSmsKeywords } from '@/lib/native/smsTracker'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useShallow } from 'zustand/react/shallow'
import { SmsSupportedBanksList } from '@/components/features/settings/SmsSupportedBanksList'

/**
 * Shown inside SettingsSmsTrackingSection when isEnabled && isAndroid().
 * Permission was already requested by the toggle; this card checks current
 * grant state in case the user revoked access from system settings.
 */
export function SmsAndroidSetupCard() {
  const onNative = isNative() && isAndroid()
  const [permState, setPermState] = useState<boolean | null>(null)
  const [showBanks, setShowBanks] = useState(false)
  const [showKeywords, setShowKeywords] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')

  const { customSmsKeywords, updateSettings } = useFinanceStore(
    useShallow((s) => ({
      customSmsKeywords: s.settings.customSmsKeywords ?? [],
      updateSettings: s.updateSettings,
    })),
  )

  useEffect(() => {
    if (!onNative) return
    checkSmsPermission().then(setPermState)
  }, [onNative])

  // Keep the native receiver's keyword vocabulary in sync (killed-app path).
  useEffect(() => {
    if (!onNative) return
    void syncSmsKeywords(customSmsKeywords)
  }, [onNative, customSmsKeywords])

  const addKeyword = useCallback(() => {
    const kw = newKeyword.trim()
    if (!kw || customSmsKeywords.includes(kw)) return
    updateSettings({ customSmsKeywords: [...customSmsKeywords, kw] })
    setNewKeyword('')
  }, [newKeyword, customSmsKeywords, updateSettings])

  /** Add multiple keywords at once (comma/newline-separated paste). */
  const addKeywords = useCallback(
    (raw: string) => {
      const tokens = raw.split(/[,\n]/).map((k) => k.trim()).filter(Boolean)
      if (!tokens.length) return
      const merged = [...customSmsKeywords]
      for (const tok of tokens) if (!merged.includes(tok)) merged.push(tok)
      if (merged.length !== customSmsKeywords.length) {
        updateSettings({ customSmsKeywords: merged })
      }
      setNewKeyword('')
    },
    [customSmsKeywords, updateSettings],
  )

  const removeKeyword = useCallback(
    (kw: string) => {
      updateSettings({ customSmsKeywords: customSmsKeywords.filter((k) => k !== kw) })
    },
    [customSmsKeywords, updateSettings],
  )

  if (!onNative) return null

  if (permState === null) {
    return <p className="text-xs text-[var(--color-brand-text-muted)]">Checking permission…</p>
  }

  if (permState === false) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-[var(--color-brand-amber)]/40 bg-[var(--color-brand-amber)]/10 px-3 py-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-brand-amber)]" />
        <p className="text-xs text-[var(--color-brand-text-secondary)]">
          SMS permission was revoked. Go to{' '}
          <strong>Settings → Apps → Buddget → Permissions</strong> to restore access.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Active badge */}
      <div className="flex items-center gap-2 pb-1">
        <ShieldCheck className="h-4 w-4 text-[var(--color-brand-green)]" />
        <span className="text-xs font-medium text-[var(--color-brand-green)]">
          Active — listening for bank SMS
        </span>
      </div>

      {/* Supported Banks accordion */}
      <div className="rounded-xl border border-[var(--color-brand-border)] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowBanks((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          Supported Banks &amp; Services
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${showBanks ? 'rotate-180' : ''}`}
          />
        </button>
        {showBanks && (
          <div className="border-t border-[var(--color-brand-border)] px-3 py-3">
            <SmsSupportedBanksList />
          </div>
        )}
      </div>

      {/* Custom Keywords accordion */}
      <div className="rounded-xl border border-[var(--color-brand-border)] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowKeywords((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          Manage Custom Keywords
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${showKeywords ? 'rotate-180' : ''}`}
          />
        </button>
        {showKeywords && (
          <div className="border-t border-[var(--color-brand-border)] px-3 py-3 space-y-2">
            <p className="text-[10px] text-[var(--color-brand-text-muted)]">
              Words that trigger SMS forwarding, merged with the built-in bank vocabulary.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {customSmsKeywords.length === 0 ? (
                <p className="text-xs italic text-[var(--color-brand-text-muted)]">No custom keywords yet.</p>
              ) : (
                customSmsKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] py-0.5 ps-2.5 pe-0.5 text-xs text-[var(--color-brand-text-primary)]"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      aria-label={`Remove ${kw}`}
                      className="inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-[var(--color-brand-border)] transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-[var(--color-brand-text-muted)]" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="flex gap-1.5">
              <input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    addKeyword()
                  }
                }}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text')
                  if (/[,\n]/.test(text)) {
                    e.preventDefault()
                    addKeywords(text)
                  }
                }}
                placeholder="e.g. Vodafone Cash"
                inputMode="text"
                className="flex-1 h-12 rounded-lg border border-[var(--color-brand-border)] bg-transparent px-3 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none focus:border-[var(--color-brand-green)]"
              />
              <button
                type="button"
                onClick={addKeyword}
                aria-label="Add keyword"
                className="inline-flex items-center justify-center h-12 w-12 shrink-0 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
