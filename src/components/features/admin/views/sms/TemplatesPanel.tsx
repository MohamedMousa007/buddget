'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, FileCode2, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { exportAsBankPatternSet } from '@/lib/sms/exportTemplates'
import { adminPost, errorMessage } from '../../adminClient'
import { failureRate, matchesFilter, type TemplateFilter } from '../../templateHealthDisplay'
import { AdminSheet } from '../../ui/AdminSheet'
import { Toolbar } from '../../ui/Field'
import { Loading, Notice, Panel } from '../../ui/Panel'
import { Pill, type Tone } from '../../ui/Pill'
import type { SmsTemplateRow } from '../../types'

const STATUS_TONE: Record<string, { label: string; tone: Tone; title: string }> = {
  active: { label: 'Active', tone: 'good', title: 'Parsing normally' },
  quarantined: { label: 'Quarantined', tone: 'warn', title: 'Shadow mode — result unused while AI decides whether to exonerate or retire it' },
  retired: { label: 'Retired', tone: 'bad', title: 'Never matched again; a replacement is learned from the correction' },
  exported: { label: 'In code', tone: 'neutral', title: 'Now lives in the code patterns; the DB row is kept for history' },
}

export function TemplatesPanel({ canManage }: { canManage: boolean }) {
  const confirm = useConfirm()
  const [rows, setRows] = useState<SmsTemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<TemplateFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [exported, setExported] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; regex: string } | null>(null)

  const post = useCallback(async (body: Record<string, unknown>) => {
    try {
      return await adminPost<Record<string, unknown>>('/api/admin/sms/templates', body)
    } catch (e) {
      setError(errorMessage(e))
      return null
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await post({ op: 'list' })
    if (res) { setRows(res.templates as SmsTemplateRow[]); setError(null) }
    setLoading(false)
  }, [post])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    void load()
  }, [load])

  const patch = (id: string, next: Partial<SmsTemplateRow>) => setRows((prev) => prev.map((t) => (t.id === id ? { ...t, ...next } : t)))

  const visible = rows.filter((t) => matchesFilter(t, filter))
  const unhealthy = rows.filter((t) => t.status !== 'active').length
  const allOn = rows.length > 0 && rows.every((t) => t.ai_enabled)

  const toggle = async (t: SmsTemplateRow) => {
    const res = await post({ op: 'update', id: t.id, patch: { ai_enabled: !t.ai_enabled } })
    if (res) patch(t.id, { ai_enabled: !t.ai_enabled })
  }

  const remove = async (t: SmsTemplateRow) => {
    if (!(await confirm({ title: `Delete the template for ${t.sender}?`, body: 'This cannot be undone.', destructive: true, confirmLabel: 'Delete' }))) return
    if (await post({ op: 'delete', id: t.id })) setRows((prev) => prev.filter((x) => x.id !== t.id))
  }

  const setTier = async (t: SmsTemplateRow, op: 'promote' | 'demote') => {
    if (await post({ op, id: t.id, sender: t.sender })) patch(t.id, { tier: op === 'promote' ? 'curated_db' : 'template' })
  }

  const bulk = async () => {
    if (!(await confirm({ title: allOn ? 'Pause every template?' : 'Activate every template?', body: 'Affects the static bypass for all users.' }))) return
    if (await post({ op: 'bulk_toggle', patch: { ai_enabled: !allOn } })) await load()
  }

  const saveRegex = async () => {
    if (!editing) return
    const res = await post({ op: 'update', id: editing.id, patch: { regex_pattern: editing.regex } })
    if (res?.template) { patch(editing.id, res.template as SmsTemplateRow); setEditing(null) }
  }

  /**
   * Renders the selected templates as a pattern module for a human to review and commit.
   * Deliberately not an automatic commit: a pattern in code can only be retired by a deploy, whereas a DB row
   * is a flag flip. Samples are redacted by the exporter because a committed sample is public and permanent.
   */
  const exportSelected = () => {
    const chosen = rows.filter((t) => selected.has(t.id))
    if (chosen.length === 0) return
    const bank = chosen[0]!.sender.replace(/^(HOTLINE|BODY)-/, '') || 'Bank'
    setExported(exportAsBankPatternSet(chosen.map((t) => ({
      id: t.id, sender: t.sender, regex_pattern: t.regex_pattern, template_sample: t.template_sample, mapping_rules: t.mapping_rules,
      kind: t.kind, match_count: t.match_count, unique_user_count: t.unique_user_count,
    })), bank))
  }

  let regexError = ''
  if (editing) { try { new RegExp(editing.regex) } catch { regexError = 'Invalid regex pattern' } }

  return (
    <Panel
      flush
      title="Parse templates"
      description="Fully curated (code) → Curated DB (global) → Template (author-scoped) → AI. Templates earn global reach by agreeing with independent users’ parses."
      actions={
        <>
          {selected.size > 0 ? <Button variant="outline" size="touch" onClick={exportSelected}><FileCode2 />Export {selected.size} to code</Button> : null}
          {canManage && rows.length > 0 ? <Button variant="outline" size="touch" onClick={() => void bulk()}>Bypass: {allOn ? 'all active' : rows.every((t) => !t.ai_enabled) ? 'all paused' : 'mixed'}</Button> : null}
          <Button variant="outline" size="touch" loading={loading} onClick={() => void load()}><RefreshCw />Refresh</Button>
        </>
      }
    >
      <Toolbar>
        <SegmentedControl ariaLabel="Template filter" fill={false} value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'All', count: rows.length }, { value: 'curated_db', label: 'Curated DB' }, { value: 'template', label: 'Template' }, { value: 'unhealthy', label: 'Needs attention', count: unhealthy },
        ]} />
      </Toolbar>
      {error ? <div className="p-5"><Notice tone="negative">{error}</Notice></div> : null}
      {loading && rows.length === 0 ? <div className="p-5"><Loading rows={5} /></div> : null}
      {!loading && rows.length === 0 ? <p className="px-5 py-12 text-center text-sm text-[var(--color-brand-text-muted)]">No templates learned yet. They are created automatically when AI parses an SMS with high confidence.</p> : null}

      {visible.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr className="border-b border-[var(--color-brand-border)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
                {['', 'Sender', 'Stage', 'Sample', 'Regex', 'Matches', 'Users', 'Health', 'On', ''].map((h, i) => <th key={i} className="px-3 py-2.5 text-start">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-brand-border)]">
              {visible.map((t) => {
                const s = STATUS_TONE[t.status] ?? { label: t.status, tone: 'neutral' as Tone, title: '' }
                const rate = failureRate(t)
                return (
                  <tr key={t.id} className="align-top hover:bg-[var(--color-brand-elevated)]/50">
                    <td className="px-3 py-3"><input type="checkbox" className="size-4 accent-[var(--color-brand-primary)] disabled:opacity-30" checked={selected.has(t.id)} disabled={t.tier !== 'curated_db'} aria-label={`Select ${t.sender} for export`} title={t.tier === 'curated_db' ? 'Select for export' : 'Only Curated DB templates can be exported'} onChange={() => setSelected((p) => { const n = new Set(p); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n })} /></td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[var(--color-brand-text-primary)]">{t.sender}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <Pill tone={t.tier === 'curated_db' ? 'brand' : 'neutral'}>{t.tier === 'curated_db' ? 'Curated DB' : 'Template'}</Pill>
                        {canManage && t.tier === 'template' && t.status === 'active' ? <IconButton aria-label="Promote to global" title="Promote to global Curated DB now" size="sm" hitArea={false} variant="outlined" onClick={() => void setTier(t, 'promote')}><ArrowUp /></IconButton> : null}
                        {canManage && t.tier === 'curated_db' ? <IconButton aria-label="Demote to author-scoped" title="Demote back to author-scoped template" size="sm" hitArea={false} variant="outlined" onClick={() => void setTier(t, 'demote')}><ArrowDown /></IconButton> : null}
                      </span>
                    </td>
                    <td className="max-w-44 px-3 py-3"><span className="block truncate text-[var(--color-brand-text-secondary)]" title={t.template_sample}>{t.template_sample.slice(0, 60)}</span></td>
                    <td className="max-w-52 px-3 py-3">
                      <button type="button" data-raw-button-ok="opens the regex editor" disabled={!canManage} onClick={() => setEditing({ id: t.id, regex: t.regex_pattern })} className="block w-full truncate text-start font-mono text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]" title={t.regex_pattern}>{t.regex_pattern.slice(0, 40)}{t.regex_pattern.length > 40 ? '…' : ''}</button>
                    </td>
                    <td className="px-3 py-3"><Pill tone={t.match_count > 0 ? 'good' : 'neutral'}>{t.match_count}</Pill></td>
                    <td className="px-3 py-3" title="Distinct users whose SMS this template has matched"><Pill>{t.unique_user_count}</Pill></td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="inline-flex items-center gap-1.5" title={s.title}>
                        <Pill tone={s.tone}>{s.label}</Pill>
                        {t.hard_fail ? <span title="A hard oracle fired — the bank’s own ledger sign contradicted this template, or it captured a constant instead of the amount"><Pill tone="bad">hard</Pill></span> : null}
                        {t.failure_count > 0 ? <span className="text-[var(--color-brand-text-muted)]" title={`${t.failure_count} failure(s) over ${t.match_count} matches`}>{rate !== null ? `${Math.round(rate * 100)}%` : t.failure_count}</span> : null}
                      </span>
                    </td>
                    <td className="px-3 py-3"><Switch checked={t.ai_enabled} disabled={!canManage} aria-label={`Bypass for ${t.sender}`} onCheckedChange={() => void toggle(t)} /></td>
                    <td className="px-3 py-3">{canManage ? <IconButton aria-label={`Delete template for ${t.sender}`} variant="danger" size="sm" hitArea={false} onClick={() => void remove(t)}><Trash2 /></IconButton> : null}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <AdminSheet open={editing !== null} title="Edit regex" onClose={() => setEditing(null)} wide>
        <div className="space-y-3">
          <Textarea aria-label="Regex" rows={5} value={editing?.regex ?? ''} onChange={(e) => editing && setEditing({ ...editing, regex: e.target.value })} className="font-mono text-xs" />
          {regexError ? <p className="text-xs text-[var(--color-brand-red)]">{regexError}</p> : null}
          <Button size="cta-block" disabled={!!regexError || !editing?.regex} onClick={() => void saveRegex()}>Save regex</Button>
        </div>
      </AdminSheet>

      <AdminSheet open={exported !== null} title="Export to code patterns" onClose={() => setExported(null)} wide>
        <p className="mb-3 text-xs text-[var(--color-brand-text-muted)]">Review, then save as <code>src/lib/sms/patterns/&lt;bank&gt;.ts</code> and add it to ALL_PATTERN_SETS. Samples are redacted. Once in code a pattern needs a deploy to change, so it also leaves the automatic retirement safety net.</p>
        <pre className="max-h-[50vh] select-text overflow-auto rounded-lg bg-[var(--color-brand-elevated)] p-3 font-mono text-[11px] leading-relaxed text-[var(--color-brand-text-secondary)]">{exported}</pre>
        <Button variant="outline" size="touch" className="mt-3" onClick={() => void navigator.clipboard?.writeText(exported ?? '')}><Copy />Copy</Button>
      </AdminSheet>
    </Panel>
  )
}
