'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { AdminPanelModel } from '@/hooks/useAdminPanel'
import type { SmsPromotionConfig } from '@/types/admin'

interface Props {
  admin: AdminPanelModel
}

const DEFAULTS: Omit<SmsPromotionConfig, 'id' | 'updated_at'> = {
  min_match_count: 50,
  min_unique_users: 3,
  min_age_days: 7,
  max_failure_rate: 0.05,
  min_avg_confidence: 0.90,
  // Retirement side of the same funnel — see migration 0097.
  min_matches_before_retire: 5,
  quarantine_exonerate_after: 3,
  signals_before_adjudication: 2,
  max_user_signals_per_day: 10,
}

export function AdminSmsPromotionSection({ admin }: Props) {
  const {
    promotionConfig, promotionConfigLoading, eligibleTemplates,
    loadPromotionConfig, savePromotionConfig, runAutoPromotion, checkEligibility,
  } = admin

  const [draft, setDraft] = useState<SmsPromotionConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ promoted: number; eligible: number } | null>(null)

  useEffect(() => {
    void loadPromotionConfig()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (promotionConfig && !draft) setDraft({ ...promotionConfig })
  }, [promotionConfig, draft])

  const handleSave = async () => {
    if (!draft) return
    setSaving(true)
    await savePromotionConfig(draft)
    await checkEligibility()
    setSaving(false)
  }

  const handleReset = async () => {
    if (!draft) return
    const reset = { ...draft, ...DEFAULTS }
    setDraft(reset)
    setSaving(true)
    await savePromotionConfig(reset)
    setSaving(false)
  }

  const handleRun = async () => {
    setRunning(true)
    setRunResult(null)
    const result = await runAutoPromotion()
    setRunResult(result)
    setRunning(false)
  }

  const set = <K extends keyof SmsPromotionConfig>(key: K, value: SmsPromotionConfig[K]) => {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  const criteriaField = (
    label: string,
    description: string,
    key: keyof SmsPromotionConfig,
    step: number,
  ) => {
    const val = draft ? (draft[key] as number) : 0
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--color-brand-text-primary)]">{label}</p>
          <p className="text-[10px] text-[var(--color-brand-text-muted)]">{description}</p>
        </div>
        {/* A number input rather than a slider: these are exact thresholds a human reasons
            about ("3 distinct users", "5% failures"), and a slider makes an exact value
            fiddly to set while taking far more room in a compact overlay. */}
        <input
          type="number"
          step={step}
          min={0}
          value={val}
          disabled={!draft}
          onChange={(e) => set(key, parseFloat(e.target.value || '0') as SmsPromotionConfig[typeof key])}
          className="w-20 shrink-0 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] px-2 py-1 text-right text-xs font-mono text-[var(--color-brand-text-primary)] outline-none focus:border-[var(--color-brand-focus)] disabled:opacity-50"
        />
      </div>
    )
  }

  return (
    <section className="glass-card rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-brand-text-primary)]">
            Template Auto-Promotion
          </h2>
          <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5">
            Templates that meet these criteria are automatically promoted. Edit and save to change thresholds; Reset restores factory defaults.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadPromotionConfig()}
          disabled={promotionConfigLoading}
          className="flex items-center gap-1.5 text-xs rounded-xl border border-[var(--color-brand-border)] px-3 py-1.5 text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${promotionConfigLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {promotionConfigLoading && !draft && (
        <p className="text-xs text-[var(--color-brand-text-muted)] text-center py-4">Loading…</p>
      )}

      {draft && (
        <>
          {/* Criteria sliders */}
          <div className="rounded-xl border border-[var(--color-brand-border)] px-4 py-4 space-y-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-brand-text-muted)]">
              Promotion Criteria
            </p>
            {criteriaField('Min matches', 'Times this template matched an SMS', 'min_match_count', 5)}
            {criteriaField('Min distinct users', 'Different users who triggered this template', 'min_unique_users', 1)}
            {criteriaField('Min age (days)', 'How long since the template was first learned', 'min_age_days', 1)}
            {criteriaField('Max failure rate', 'Fraction of matches that may fail before retire (0.05 = 5%)', 'max_failure_rate', 0.005)}
            {criteriaField('Min avg AI confidence', 'Minimum Gemini confidence score when template was created', 'min_avg_confidence', 0.01)}
          </div>

          {/* Retirement + adjudication — the other half of the funnel (migration 0097/0098). */}
          <div className="rounded-xl border border-[var(--color-brand-border)] px-4 py-4 space-y-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-brand-text-muted)]">
              Retirement &amp; Health
            </p>
            {criteriaField('Min matches before retire', 'Matches served before a soft-signal rate can retire a template', 'min_matches_before_retire', 1)}
            {criteriaField('Shadow agreements to exonerate', 'Consecutive AI agreements that clear a quarantined template', 'quarantine_exonerate_after', 1)}
            {criteriaField('Signals before adjudication', 'User signals on one template before an AI adjudication is spent', 'signals_before_adjudication', 1)}
            {criteriaField('Max user signals / day', 'Per-user cap so a bulk delete cannot mass-quarantine', 'max_user_signals_per_day', 1)}
          </div>

          {/* Eligibility preview */}
          {eligibleTemplates.length > 0 && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
              <p className="text-xs text-amber-400 font-medium">
                {eligibleTemplates.length} template{eligibleTemplates.length > 1 ? 's' : ''} currently eligible for promotion
              </p>
              <p className="text-[10px] text-amber-400/70 mt-0.5">
                Senders: {[...new Set(eligibleTemplates.map((t) => t.sender))].join(', ')}
              </p>
            </div>
          )}

          {runResult && (
            <div className={`rounded-xl px-4 py-3 border ${
              runResult.promoted > 0
                ? 'bg-[var(--color-brand-green)]/10 border-[var(--color-brand-green)]/30'
                : 'bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)]'
            }`}>
              <p className={`text-xs font-medium ${runResult.promoted > 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-text-muted)]'}`}>
                {runResult.promoted > 0
                  ? `Promoted ${runResult.promoted} of ${runResult.eligible} eligible template${runResult.promoted > 1 ? 's' : ''}`
                  : runResult.eligible > 0
                    ? `${runResult.eligible} eligible but already promoted`
                    : 'No templates currently meet the criteria'}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex-1 h-10 rounded-xl bg-[var(--color-brand-green)] text-white text-sm font-medium disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Saving…' : 'Save Criteria'}
            </button>
            <button
              type="button"
              onClick={() => void handleReset()}
              disabled={saving}
              className="h-10 px-4 rounded-xl border border-[var(--color-brand-border)] text-[var(--color-brand-text-muted)] text-sm font-medium hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] disabled:opacity-50 transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => void handleRun()}
              disabled={running}
              className="flex-1 h-10 rounded-xl border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm font-medium hover:bg-[var(--color-brand-elevated)] disabled:opacity-50 transition-colors"
            >
              {running ? 'Running…' : 'Run Check'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
