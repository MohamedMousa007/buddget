'use client'

import { useState } from 'react'
import { Bug, Lightbulb, Send, CheckCircle } from 'lucide-react'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { useT } from '@/lib/i18n'

type FeedbackType = 'bug' | 'feature'

export default function SettingsFeedbackPage() {
  const t = useT()
  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title, description }),
      })
      const data = await res.json() as { error?: string; identifier?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setDone(data.identifier ?? '✓')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SettingsSubPageShell title={t.settings.hub.feedback} showSave={false}>
      {done ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <CheckCircle className="w-12 h-12 text-[var(--color-brand-green)]" />
          <div>
            <p className="text-base font-semibold text-[var(--color-brand-text-primary)]">
              {t.settings.feedback.successTitle}
            </p>
            <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">
              {t.settings.feedback.successBody.replace('{id}', done)}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['bug', 'feature'] as FeedbackType[]).map((v) => {
              const Icon = v === 'bug' ? Bug : Lightbulb
              const label = v === 'bug' ? t.settings.feedback.typeBug : t.settings.feedback.typeFeature
              const active = type === v
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setType(v)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-[var(--color-brand-red)]'
                      : 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </button>
              )
            })}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
              {t.settings.feedback.labelTitle}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.settings.feedback.placeholderTitle}
              required
              minLength={3}
              maxLength={200}
              className="w-full h-11 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none focus:border-[var(--color-brand-red)] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
              {t.settings.feedback.labelDescription}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.settings.feedback.placeholderDescription}
              rows={5}
              maxLength={5000}
              className="w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 py-3 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none focus:border-[var(--color-brand-red)] transition-colors resize-none"
            />
          </div>

          {error && <p className="text-sm text-[var(--color-brand-red)]">{error}</p>}

          <button
            type="submit"
            disabled={loading || title.length < 3}
            className="flex items-center gap-2 h-11 w-full justify-center rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {loading ? t.settings.feedback.submitting : t.settings.feedback.submit}
          </button>
        </form>
      )}
    </SettingsSubPageShell>
  )
}
