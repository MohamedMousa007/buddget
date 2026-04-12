'use client'

import { ClipboardList } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import type { AdminPanelModel } from '@/hooks/useAdminPanel'

export interface AdminSurveySectionProps {
  admin: AdminPanelModel
}

/**
 * JSON editor for onboarding survey rows + publish.
 */
export function AdminSurveySection({ admin }: AdminSurveySectionProps) {
  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardList className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          Onboarding survey (JSON)
        </h2>
      </div>
      <p className="text-[11px] text-[var(--color-brand-text-muted)]">
        Edit <code className="text-[var(--color-brand-text-secondary)]">config.steps</code>, save, then publish one
        version. Invalid JSON or schema will be rejected.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={admin.surveyLoading || !admin.sessionPin}
          onClick={() => void admin.loadSurveyRows()}
          className="text-xs px-3 py-2 rounded-xl bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] hover:border-[var(--color-brand-red)]/40 disabled:opacity-50"
        >
          {admin.surveyLoading ? 'Loading…' : 'Load survey rows'}
        </button>
        {admin.surveyRows.length > 0 ? (
          <label className="text-[11px] text-[var(--color-brand-text-secondary)] flex items-center gap-2">
            Row
            <select
              className="bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] rounded-lg px-2 py-1 text-[var(--color-brand-text-primary)]"
              value={admin.surveyEditId ?? ''}
              onChange={(e) => {
                const id = e.target.value
                admin.setSurveyEditId(id)
                const row = admin.surveyRows.find((r) => r.id === id)
                if (row) admin.setSurveyJson(JSON.stringify(row.config ?? { steps: [] }, null, 2))
              }}
            >
              {admin.surveyRows.map((r) => (
                <option key={r.id} value={r.id}>
                  v{r.version} {r.published ? '(published)' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <Textarea
        value={admin.surveyJson}
        onChange={(e) => admin.setSurveyJson(e.target.value)}
        className="min-h-[220px] bg-[var(--color-brand-bg)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers text-[11px]"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={admin.surveyBusy || !admin.sessionPin || !admin.surveyEditId}
          onClick={() => void admin.saveSurveyConfig()}
          className="text-xs px-3 py-2 rounded-xl bg-[var(--color-brand-red)] text-white font-semibold disabled:opacity-50"
        >
          {admin.surveyBusy ? 'Saving…' : 'Save config'}
        </button>
        <button
          type="button"
          disabled={admin.surveyBusy || !admin.sessionPin || !admin.surveyEditId}
          onClick={() => void admin.publishSurvey()}
          className="text-xs px-3 py-2 rounded-xl border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] disabled:opacity-50"
        >
          Publish selected
        </button>
      </div>
    </section>
  )
}
