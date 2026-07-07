'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Trash2, ListTree, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import type { AdminPanelModel } from '@/hooks/useAdminPanel'
import type { SmsTemplateRow } from '@/types/admin'

interface Props {
  admin: AdminPanelModel
}

export function AdminSmsTemplatesSection({ admin }: Props) {
  const {
    smsTemplates, smsTemplatesLoading, loadSmsTemplates,
    updateSmsTemplate, deleteSmsTemplate, bulkToggleSmsTemplates,
    keywordPool, senderPool, keywordPoolLoading, loadKeywordPool,
  } = admin

  const [showPool, setShowPool] = useState(false)
  const openPool = () => { setShowPool(true); void loadKeywordPool() }

  const allEnabled  = smsTemplates.length > 0 && smsTemplates.every((t) => t.ai_enabled)
  const allDisabled = smsTemplates.length > 0 && smsTemplates.every((t) => !t.ai_enabled)
  const masterLabel = allEnabled ? 'All Active' : allDisabled ? 'All Paused' : smsTemplates.length > 0 ? 'Mixed' : null

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingRegex, setEditingRegex] = useState('')
  const [editError, setEditError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    void loadSmsTemplates()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startEdit = (tpl: SmsTemplateRow) => {
    setEditingId(tpl.id)
    setEditingRegex(tpl.regex_pattern)
    setEditError('')
  }

  const handleRegexChange = (value: string) => {
    setEditingRegex(value)
    try {
      new RegExp(value)
      setEditError('')
    } catch {
      setEditError('Invalid regex pattern')
    }
  }

  const handleSaveRegex = async (id: string) => {
    if (editError) return
    setSavingId(id)
    const ok = await updateSmsTemplate(id, { regex_pattern: editingRegex })
    setSavingId(null)
    if (ok) setEditingId(null)
  }

  const handleToggle = async (id: string, current: boolean) => {
    await updateSmsTemplate(id, { ai_enabled: !current })
  }

  const handleDelete = async (id: string, sender: string) => {
    if (!window.confirm(`Delete template for sender "${sender}"? This cannot be undone.`)) return
    await deleteSmsTemplate(id)
  }

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-brand-text-primary)]">
            SMS Parse Templates
          </h2>
          <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5">
            Learned regex patterns that bypass Gemini for known bank SMS formats.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {masterLabel && (
            <button
              type="button"
              onClick={() => void bulkToggleSmsTemplates(!allEnabled)}
              disabled={smsTemplatesLoading}
              className={`text-xs rounded-xl px-3 py-1.5 border transition-colors disabled:opacity-50 ${
                allEnabled
                  ? 'border-[var(--color-brand-green)]/40 bg-[var(--color-brand-green)]/10 text-[var(--color-brand-green)] hover:bg-[var(--color-brand-green)]/20'
                  : allDisabled
                    ? 'border-[var(--color-brand-border)] text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)]'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
              }`}
              title={allEnabled ? 'Click to pause all static bypass templates' : 'Click to activate all static bypass templates'}
            >
              Bypass: {masterLabel}
            </button>
          )}
          <button
            type="button"
            onClick={openPool}
            className="flex items-center gap-1.5 text-xs rounded-xl border border-[var(--color-brand-border)] px-3 py-1.5 text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] transition-colors"
            title="Keyword + sender frequency pool collected from confirmed transactions (Phase-2 allowlist data)"
          >
            <ListTree className="h-3.5 w-3.5" />
            Keyword Pool
          </button>
          <button
            type="button"
            onClick={() => void loadSmsTemplates()}
            disabled={smsTemplatesLoading}
            className="flex items-center gap-1.5 text-xs rounded-xl border border-[var(--color-brand-border)] px-3 py-1.5 text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${smsTemplatesLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {showPool && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowPool(false)}
        >
          <div
            className="glass-card w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-brand-border)]">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-brand-text-primary)]">SMS Keyword Pool</h3>
                <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5">
                  Vocabulary + senders learned from confirmed transactions, by frequency.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void loadKeywordPool()}
                  disabled={keywordPoolLoading}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--color-brand-elevated)] disabled:opacity-50"
                  aria-label="Refresh keyword pool"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${keywordPoolLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPool(false)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--color-brand-elevated)]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-5">
              {keywordPoolLoading && keywordPool.length === 0 && (
                <p className="text-xs text-[var(--color-brand-text-muted)] py-4 text-center">Loading…</p>
              )}

              {/* Senders */}
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-brand-text-muted)] mb-2">
                  Senders ({senderPool.length})
                </h4>
                {senderPool.length === 0 ? (
                  <p className="text-xs text-[var(--color-brand-text-muted)]">No senders pooled yet.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--color-brand-border)] text-[10px] uppercase tracking-wide text-[var(--color-brand-text-muted)]">
                        <th className="text-left py-1.5 pr-4">Sender</th>
                        <th className="text-center py-1.5 pr-4">Hits</th>
                        <th className="text-center py-1.5">Txns</th>
                      </tr>
                    </thead>
                    <tbody>
                      {senderPool.map((s) => (
                        <tr key={s.sender} className="border-b border-[var(--color-brand-border)]/50">
                          <td className="py-1.5 pr-4 font-mono text-[var(--color-brand-text-primary)]">{s.sender}</td>
                          <td className="py-1.5 pr-4 text-center text-[var(--color-brand-text-secondary)]">{s.hit_count}</td>
                          <td className="py-1.5 text-center text-[var(--color-brand-text-secondary)]">{s.txn_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Keywords */}
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-brand-text-muted)] mb-2">
                  Keywords ({keywordPool.length})
                </h4>
                {keywordPool.length === 0 ? (
                  <p className="text-xs text-[var(--color-brand-text-muted)]">No keywords pooled yet.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--color-brand-border)] text-[10px] uppercase tracking-wide text-[var(--color-brand-text-muted)]">
                        <th className="text-left py-1.5 pr-4">Keyword</th>
                        <th className="text-left py-1.5 pr-4">Lang</th>
                        <th className="text-center py-1.5">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keywordPool.map((k) => (
                        <tr key={k.keyword} className="border-b border-[var(--color-brand-border)]/50">
                          <td className="py-1.5 pr-4 font-mono text-[var(--color-brand-text-primary)]">{k.keyword}</td>
                          <td className="py-1.5 pr-4 text-[var(--color-brand-text-muted)] uppercase">{k.lang ?? '—'}</td>
                          <td className="py-1.5 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-brand-green)]/10 text-[var(--color-brand-green)]">
                              {k.hit_count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {smsTemplatesLoading && smsTemplates.length === 0 && (
        <p className="text-xs text-[var(--color-brand-text-muted)] py-4 text-center">Loading…</p>
      )}

      {!smsTemplatesLoading && smsTemplates.length === 0 && (
        <p className="text-xs text-[var(--color-brand-text-muted)] py-4 text-center">
          No templates learned yet. Templates are created automatically when Gemini parses an SMS with ≥ 90% confidence.
        </p>
      )}

      {smsTemplates.length > 0 && (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-96 text-xs">
            <thead>
              <tr className="border-b border-[var(--color-brand-border)]">
                <th className="text-left py-2 pr-4 font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wide text-[10px]">Sender</th>
                <th className="text-left py-2 pr-4 font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wide text-[10px]">Sample</th>
                <th className="text-left py-2 pr-4 font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wide text-[10px]">Regex</th>
                <th className="text-center py-2 pr-4 font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wide text-[10px]">Matches</th>
                <th className="text-center py-2 pr-4 font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wide text-[10px]">Users</th>
                <th className="text-center py-2 pr-4 font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wide text-[10px]">Active</th>
                <th className="text-center py-2 font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wide text-[10px]">Delete</th>
              </tr>
            </thead>
            <tbody>
              {smsTemplates.map((tpl) => (
                <tr key={tpl.id} className="border-b border-[var(--color-brand-border)] hover:bg-[var(--color-brand-elevated)] transition-colors">
                  {/* Sender */}
                  <td className="py-2.5 pr-4 font-mono text-[var(--color-brand-text-primary)] whitespace-nowrap">
                    {tpl.sender}
                  </td>

                  {/* Sample */}
                  <td className="py-2.5 pr-4 max-w-40">
                    <span
                      className="block truncate text-[var(--color-brand-text-secondary)] cursor-default"
                      title={tpl.template_sample}
                    >
                      {tpl.template_sample.slice(0, 60)}
                    </span>
                  </td>

                  {/* Regex — inline edit */}
                  <td className="py-2.5 pr-4 max-w-48">
                    {editingId === tpl.id ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={editingRegex}
                          onChange={(e) => handleRegexChange(e.target.value)}
                          rows={3}
                          className="w-full font-mono text-[10px] rounded-lg border border-[var(--color-brand-border)] bg-transparent px-2 py-1.5 text-[var(--color-brand-text-primary)] focus:outline-none focus:border-[var(--color-brand-green)] resize-none"
                        />
                        {editError && (
                          <p className="text-[10px] text-[var(--color-brand-red)]">{editError}</p>
                        )}
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleSaveRegex(tpl.id)}
                            disabled={!!editError || savingId === tpl.id}
                            className="text-[10px] rounded-lg bg-[var(--color-brand-green)] text-white px-2.5 py-1 disabled:opacity-50"
                          >
                            {savingId === tpl.id ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-[10px] rounded-lg border border-[var(--color-brand-border)] px-2.5 py-1 text-[var(--color-brand-text-muted)]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(tpl)}
                        className="block truncate font-mono text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] transition-colors text-left w-full"
                        title={tpl.regex_pattern}
                      >
                        {tpl.regex_pattern.slice(0, 40)}{tpl.regex_pattern.length > 40 ? '…' : ''}
                      </button>
                    )}
                  </td>

                  {/* Match count */}
                  <td className="py-2.5 pr-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      tpl.match_count > 0
                        ? 'bg-[var(--color-brand-green)]/10 text-[var(--color-brand-green)]'
                        : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)]'
                    }`}>
                      {tpl.match_count}
                    </span>
                  </td>

                  {/* Distinct users */}
                  <td className="py-2.5 pr-4 text-center">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]"
                      title="Distinct users whose SMS this template has matched"
                    >
                      {tpl.unique_user_count}
                    </span>
                  </td>

                  {/* AI Active toggle */}
                  <td className="py-2.5 pr-4 text-center">
                    <Switch
                      checked={tpl.ai_enabled}
                      onCheckedChange={() => void handleToggle(tpl.id, tpl.ai_enabled)}
                    />
                  </td>

                  {/* Delete */}
                  <td className="py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => void handleDelete(tpl.id, tpl.sender)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-red-900/30 transition-colors"
                      aria-label={`Delete template for ${tpl.sender}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[var(--color-brand-red)]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
