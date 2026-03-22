'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Bot,
  Server,
  CheckCircle2,
  XCircle,
  Lock,
  ArrowLeft,
  Users,
  BarChart3,
  ClipboardList,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import Link from 'next/link'
import { PAGE_HEADER_SURFACE_CLASS } from '@/components/layout/PageHeader'

interface AiRuntimeSlice {
  rateLimitingEnabled: boolean
  rateLimitMaxRequests: number
  rateLimitWindowMs: number
}

interface AdminConfig {
  ai: {
    enabled: boolean
    model: string
    keyPreview: string | null
    runtime: {
      stored: AiRuntimeSlice
      effective: AiRuntimeSlice
      persistedToDisk: boolean
      envHints: {
        AI_RATE_LIMITING_ENABLED: string | null
        AI_RATE_LIMIT_MAX: string | null
        AI_RATE_LIMIT_WINDOW_MS: string | null
      }
    }
  }
  environment: string
  appUrl: string
}

export default function AdminPage() {
  const [pin, setPin] = useState('')
  const [sessionPin, setSessionPin] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [config, setConfig] = useState<AdminConfig | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [rateLimitingEnabled, setRateLimitingEnabled] = useState(false)
  const [rateLimitMax, setRateLimitMax] = useState(15)
  const [rateLimitWindowSec, setRateLimitWindowSec] = useState(60)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const [platformMessage, setPlatformMessage] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [users, setUsers] = useState<
    Array<{
      id: string
      email: string | undefined
      created_at: string
      last_sign_in_at: string | null
      onboarding_completed: boolean
    }>
  >([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analytics, setAnalytics] = useState<{
    since: string
    days: number
    eventCount: number
    byUser: Record<
      string,
      { heartbeats: number; engagedSecondsApprox: number; sessionStarts: number }
    >
  } | null>(null)
  const [surveyLoading, setSurveyLoading] = useState(false)
  const [surveyRows, setSurveyRows] = useState<
    Array<{ id: string; version: number; published: boolean; config: unknown; updated_at: string }>
  >([])
  const [surveyEditId, setSurveyEditId] = useState<string | null>(null)
  const [surveyJson, setSurveyJson] = useState('')
  const [surveyBusy, setSurveyBusy] = useState(false)

  const handleLogin = async () => {
    if (!pin.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Authentication failed')
        return
      }

      setAuthenticated(true)
      setSessionPin(pin.trim())
      setConfig(data.config)
      const rt = data.config?.ai?.runtime?.stored
      if (rt) {
        setRateLimitingEnabled(rt.rateLimitingEnabled)
        setRateLimitMax(rt.rateLimitMaxRequests)
        setRateLimitWindowSec(Math.round(rt.rateLimitWindowMs / 1000))
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-8 w-full max-w-sm"
        >
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-brand-elevated)] flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-[var(--color-brand-red)]" />
            </div>
            <h1 className="text-xl font-bold text-white">Admin Panel</h1>
            <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">
              Enter your admin PIN to continue
            </p>
          </div>

          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white text-center text-2xl tracking-[0.5em] font-mono-numbers placeholder:text-[var(--color-brand-text-muted)] placeholder:tracking-normal placeholder:text-sm"
              autoFocus
            />

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-sm text-[var(--color-brand-red)] text-center"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              onClick={handleLogin}
              disabled={!pin.trim() || loading}
              className="w-full py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {loading ? 'Verifying...' : 'Unlock'}
            </button>

            <Link
              href="/"
              className="block text-center text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)] transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className={PAGE_HEADER_SURFACE_CLASS}>
        <div className="flex items-center justify-between px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="p-1.5 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--color-brand-red)]" />
              <h1 className="text-xl font-bold text-white">Admin Panel</h1>
            </div>
          </div>
          <button
            onClick={() => {
              setAuthenticated(false)
              setConfig(null)
              setPin('')
              setSessionPin('')
              setSaveMessage('')
            }}
            className="text-xs text-[var(--color-brand-text-muted)] hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-[var(--color-brand-border)]"
          >
            Lock
          </button>
        </div>
      </header>

      <div className="px-4 py-6 lg:px-8 space-y-6 max-w-3xl mx-auto">
        {platformMessage ? (
          <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-xs text-[var(--color-brand-text-secondary)]">
            {platformMessage}
          </div>
        ) : null}
        {/* AI Configuration */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-5 h-5 text-[var(--color-brand-red)]" />
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
              AI Assistant
            </h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--color-brand-text-secondary)]">Status</span>
              <span className="flex items-center gap-2">
                {!config?.ai.keyPreview ? (
                  <>
                    <XCircle className="w-4 h-4 text-[var(--color-brand-red)]" />
                    <span className="text-sm text-[var(--color-brand-red)] font-medium">No API key</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[var(--color-brand-green)]" />
                    <span className="text-sm text-[var(--color-brand-green)] font-medium">Active</span>
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-[var(--color-brand-border)]">
              <span className="text-sm text-[var(--color-brand-text-secondary)]">Model</span>
              <span className="text-sm font-mono-numbers text-white">{config?.ai.model || '—'}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-[var(--color-brand-border)]">
              <span className="text-sm text-[var(--color-brand-text-secondary)]">API Key</span>
              <span className="text-sm font-mono-numbers text-[var(--color-brand-text-muted)]">
                {config?.ai.keyPreview || 'Not set'}
              </span>
            </div>

            {!config?.ai.keyPreview && (
              <div className="p-3 rounded-xl bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)]">
                <p className="text-xs text-[var(--color-brand-text-secondary)]">
                  To enable AI, add <code className="text-[var(--color-brand-red)] bg-[var(--color-brand-bg)] px-1 py-0.5 rounded">GEMINI_API_KEY</code> to
                  your <code className="text-[var(--color-brand-red)] bg-[var(--color-brand-bg)] px-1 py-0.5 rounded">.env.local</code> file
                  and restart the server.
                </p>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-brand-red)] hover:text-[var(--color-brand-red-hover)] mt-2 inline-block"
                >
                  Get a free Gemini API key →
                </a>
              </div>
            )}

            <div className="pt-2 border-t border-[var(--color-brand-border)] space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-white mb-1">Optional: throttle users on this server</h3>
                <p className="text-[11px] text-[var(--color-brand-text-muted)] mb-3">
                  <span className="text-[var(--color-brand-text-secondary)]">Off</span> = no Buddget-side limits (only you or you
                  trust your users). Google&apos;s Gemini quotas still apply.{' '}
                  <span className="text-[var(--color-brand-text-secondary)]">On</span> = cap how many AI calls each device (IP) can
                  make per time window — useful on a shared app or to protect a tight API plan.
                </p>
                <p className="text-[11px] text-amber-200/90 mb-3 p-2 rounded-lg bg-amber-950/30 border border-amber-900/40">
                  If you see &quot;quota exceeded&quot; or &quot;free_tier_requests&quot; from Google, that is{' '}
                  <strong className="text-amber-100">not</strong> fixed by turning throttling off here — that message is from
                  Google&apos;s API (e.g. ~20 RPM on free tier). Wait, send fewer chats, or add billing in Google AI Studio.
                </p>
                <a
                  href="https://ai.google.dev/gemini-api/docs/rate-limits"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[var(--color-brand-red)] hover:underline"
                >
                  Gemini API limits (Google) →
                </a>
              </div>

              {(config?.ai.runtime.envHints.AI_RATE_LIMITING_ENABLED ||
                config?.ai.runtime.envHints.AI_RATE_LIMIT_MAX ||
                config?.ai.runtime.envHints.AI_RATE_LIMIT_WINDOW_MS) && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50">
                  <p className="text-xs text-amber-200/90 font-medium mb-1">Environment overrides active</p>
                  <p className="text-[11px] text-amber-100/80">
                    These variables in <code className="px-1 rounded bg-black/30">.env</code> override saved Admin settings until
                    removed and the server restarts:
                  </p>
                  <ul className="text-[11px] text-amber-100/80 mt-2 font-mono-numbers space-y-0.5">
                    {config?.ai.runtime.envHints.AI_RATE_LIMITING_ENABLED ? (
                      <li>AI_RATE_LIMITING_ENABLED={config.ai.runtime.envHints.AI_RATE_LIMITING_ENABLED}</li>
                    ) : null}
                    {config?.ai.runtime.envHints.AI_RATE_LIMIT_MAX ? (
                      <li>AI_RATE_LIMIT_MAX={config.ai.runtime.envHints.AI_RATE_LIMIT_MAX}</li>
                    ) : null}
                    {config?.ai.runtime.envHints.AI_RATE_LIMIT_WINDOW_MS ? (
                      <li>AI_RATE_LIMIT_WINDOW_MS={config.ai.runtime.envHints.AI_RATE_LIMIT_WINDOW_MS}</li>
                    ) : null}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm text-white">Throttle per device (IP)</p>
                  <p className="text-[11px] text-[var(--color-brand-text-muted)]">
                    Turn off for solo use; turn on to limit what each visitor can send to Gemini through your server.
                  </p>
                </div>
                <Switch checked={rateLimitingEnabled} onCheckedChange={setRateLimitingEnabled} />
              </div>

              <div
                className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${!rateLimitingEnabled ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div>
                  <label className="text-xs text-[var(--color-brand-text-secondary)] block mb-1">
                    Max requests / window (per device)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={rateLimitMax}
                    onChange={(e) => setRateLimitMax(Number(e.target.value))}
                    className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-brand-text-secondary)] block mb-1">
                    Window (seconds)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={3600}
                    value={rateLimitWindowSec}
                    onChange={(e) => setRateLimitWindowSec(Number(e.target.value))}
                    className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRateLimitingEnabled(false)
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
                >
                  Preset: no throttling
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRateLimitingEnabled(true)
                    setRateLimitMax(15)
                    setRateLimitWindowSec(60)
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
                >
                  Preset: cautious (15 / 60s)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRateLimitingEnabled(true)
                    setRateLimitMax(5)
                    setRateLimitWindowSec(60)
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
                >
                  Preset: strict (5 / 60s)
                </button>
              </div>

              {config?.ai.runtime ? (
                <p className="text-[11px] text-[var(--color-brand-text-muted)]">
                  <span className="text-[var(--color-brand-text-secondary)]">Currently applied:</span>{' '}
                  {config.ai.runtime.effective.rateLimitingEnabled
                    ? `throttling on — ${config.ai.runtime.effective.rateLimitMaxRequests} req / ${Math.round(config.ai.runtime.effective.rateLimitWindowMs / 1000)}s per device`
                    : 'no server-side throttling (Gemini limits only)'}
                  {JSON.stringify(config.ai.runtime.stored) !== JSON.stringify(config.ai.runtime.effective)
                    ? ' — env overrides differ from saved file (see banner)'
                    : ''}
                </p>
              ) : null}

              <button
                type="button"
                disabled={saveLoading || !sessionPin}
                onClick={async () => {
                  const maxReq = Number(rateLimitMax)
                  const winSec = Number(rateLimitWindowSec)
                  if (rateLimitingEnabled) {
                    if (!Number.isFinite(maxReq) || maxReq < 1 || !Number.isFinite(winSec) || winSec < 1) {
                      setSaveMessage('When throttling is on, enter valid limits (min 1).')
                      return
                    }
                  }
                  setSaveLoading(true)
                  setSaveMessage('')
                  try {
                    const res = await fetch('/api/admin', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        pin: sessionPin,
                        aiRuntime: {
                          rateLimitingEnabled,
                          rateLimitMaxRequests: Number.isFinite(maxReq) && maxReq >= 1 ? maxReq : 15,
                          rateLimitWindowMs: Math.min(
                            3_600_000,
                            Math.max(1000, (Number.isFinite(winSec) && winSec >= 1 ? winSec : 60) * 1000)
                          ),
                        },
                      }),
                    })
                    const data = await res.json()
                    if (!res.ok) {
                      setSaveMessage(data.error || 'Save failed')
                      return
                    }
                    setConfig(data.config)
                    setSaveMessage('Saved.')
                    const st = data.config?.ai?.runtime?.stored
                    if (st) {
                      setRateLimitingEnabled(st.rateLimitingEnabled)
                      setRateLimitMax(st.rateLimitMaxRequests)
                      setRateLimitWindowSec(Math.round(st.rateLimitWindowMs / 1000))
                    }
                  } catch {
                    setSaveMessage('Network error')
                  } finally {
                    setSaveLoading(false)
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold disabled:opacity-50"
              >
                {saveLoading ? 'Saving…' : 'Save throttling settings'}
              </button>
              {saveMessage ? (
                <p
                  className={`text-xs ${saveMessage === 'Saved.' ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red)]'}`}
                >
                  {saveMessage}
                </p>
              ) : null}
              <p className="text-[10px] text-[var(--color-brand-text-muted)]">
                Settings file: <code className="text-[var(--color-brand-text-secondary)]">data/ai-runtime-config.json</code>
                {config?.ai.runtime.persistedToDisk ? ' (exists)' : ' (created on first save)'}. On serverless hosts without a
                persistent disk, use{' '}
                <code className="text-[var(--color-brand-text-secondary)]">AI_RATE_LIMITING_ENABLED</code>,{' '}
                <code className="text-[var(--color-brand-text-secondary)]">AI_RATE_LIMIT_MAX</code>,{' '}
                <code className="text-[var(--color-brand-text-secondary)]">AI_RATE_LIMIT_WINDOW_MS</code>.
              </p>
            </div>
          </div>
        </section>

        {/* Supabase users */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-[var(--color-brand-red)]" />
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
              Users (Supabase)
            </h2>
          </div>
          <p className="text-[11px] text-[var(--color-brand-text-muted)]">
            Requires <code className="text-[var(--color-brand-text-secondary)]">SUPABASE_SERVICE_ROLE_KEY</code> on the server.
          </p>
          <button
            type="button"
            disabled={usersLoading || !sessionPin}
            onClick={async () => {
              setPlatformMessage('')
              setUsersLoading(true)
              try {
                const res = await fetch('/api/admin/users', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ pin: sessionPin, perPage: 200, page: 1 }),
                })
                const data = await res.json()
                if (!res.ok) {
                  setPlatformMessage(data.error || 'Failed to load users')
                  return
                }
                setUsers(data.users ?? [])
                setPlatformMessage(`Loaded ${data.users?.length ?? 0} users.`)
              } catch {
                setPlatformMessage('Network error')
              } finally {
                setUsersLoading(false)
              }
            }}
            className="text-xs px-3 py-2 rounded-xl bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white hover:border-[var(--color-brand-red)]/40 disabled:opacity-50"
          >
            {usersLoading ? 'Loading…' : 'Load users'}
          </button>
          {users.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-brand-border)] max-h-72 overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-[var(--color-brand-bg)] text-[var(--color-brand-text-muted)]">
                  <tr>
                    <th className="p-2 font-medium">Email</th>
                    <th className="p-2 font-medium">Onboarding</th>
                    <th className="p-2 font-medium">Last sign-in</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-[var(--color-brand-border)]">
                      <td className="p-2 text-white font-mono-numbers">{u.email || u.id.slice(0, 8)}</td>
                      <td className="p-2">{u.onboarding_completed ? 'Done' : 'Pending'}</td>
                      <td className="p-2 text-[var(--color-brand-text-secondary)]">
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        {/* Usage analytics */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-[var(--color-brand-red)]" />
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
              Usage (approx.)
            </h2>
          </div>
          <p className="text-[11px] text-[var(--color-brand-text-muted)]">
            Heartbeats while the app tab is visible (~45s chunks). Not exact device screen time.
          </p>
          <button
            type="button"
            disabled={analyticsLoading || !sessionPin}
            onClick={async () => {
              setPlatformMessage('')
              setAnalyticsLoading(true)
              try {
                const res = await fetch('/api/admin/analytics', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ pin: sessionPin, days: 7 }),
                })
                const data = await res.json()
                if (!res.ok) {
                  setPlatformMessage(data.error || 'Failed to load analytics')
                  return
                }
                setAnalytics(data)
                setPlatformMessage(`Loaded ${data.eventCount ?? 0} events since ${data.since ?? '—'}.`)
              } catch {
                setPlatformMessage('Network error')
              } finally {
                setAnalyticsLoading(false)
              }
            }}
            className="text-xs px-3 py-2 rounded-xl bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white hover:border-[var(--color-brand-red)]/40 disabled:opacity-50"
          >
            {analyticsLoading ? 'Loading…' : 'Load last 7 days'}
          </button>
          {analytics && users.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-brand-border)] max-h-72 overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-[var(--color-brand-bg)] text-[var(--color-brand-text-muted)]">
                  <tr>
                    <th className="p-2 font-medium">User</th>
                    <th className="p-2 font-medium">Sessions</th>
                    <th className="p-2 font-medium">~Engaged</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const row = analytics.byUser[u.id]
                    return (
                      <tr key={u.id} className="border-t border-[var(--color-brand-border)]">
                        <td className="p-2 text-white font-mono-numbers">{u.email || u.id.slice(0, 8)}</td>
                        <td className="p-2">{row?.sessionStarts ?? 0}</td>
                        <td className="p-2 text-[var(--color-brand-text-secondary)]">
                          {row ? `${Math.round(row.engagedSecondsApprox / 60)} min` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : analytics ? (
            <p className="text-[11px] text-[var(--color-brand-text-muted)]">
              Load users first to map analytics rows to emails.
            </p>
          ) : null}
        </section>

        {/* Onboarding survey editor */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-5 h-5 text-[var(--color-brand-red)]" />
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
              Onboarding survey (JSON)
            </h2>
          </div>
          <p className="text-[11px] text-[var(--color-brand-text-muted)]">
            Edit <code className="text-[var(--color-brand-text-secondary)]">config.steps</code>, save, then publish one version.
            Invalid JSON or schema will be rejected.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={surveyLoading || !sessionPin}
              onClick={async () => {
                setPlatformMessage('')
                setSurveyLoading(true)
                try {
                  const res = await fetch('/api/admin/survey', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin: sessionPin, op: 'list' }),
                  })
                  const data = await res.json()
                  if (!res.ok) {
                    setPlatformMessage(data.error || 'Failed to load survey')
                    return
                  }
                  const rows = data.rows ?? []
                  setSurveyRows(rows)
                  const first = rows[0]
                  if (first) {
                    setSurveyEditId(first.id)
                    setSurveyJson(JSON.stringify(first.config ?? { steps: [] }, null, 2))
                  } else {
                    setSurveyEditId(null)
                    setSurveyJson(JSON.stringify({ steps: [] }, null, 2))
                  }
                  setPlatformMessage(`Loaded ${rows.length} survey row(s).`)
                } catch {
                  setPlatformMessage('Network error')
                } finally {
                  setSurveyLoading(false)
                }
              }}
              className="text-xs px-3 py-2 rounded-xl bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white hover:border-[var(--color-brand-red)]/40 disabled:opacity-50"
            >
              {surveyLoading ? 'Loading…' : 'Load survey rows'}
            </button>
            {surveyRows.length > 0 ? (
              <label className="text-[11px] text-[var(--color-brand-text-secondary)] flex items-center gap-2">
                Row
                <select
                  className="bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] rounded-lg px-2 py-1 text-white"
                  value={surveyEditId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value
                    setSurveyEditId(id)
                    const row = surveyRows.find((r) => r.id === id)
                    if (row) setSurveyJson(JSON.stringify(row.config ?? { steps: [] }, null, 2))
                  }}
                >
                  {surveyRows.map((r) => (
                    <option key={r.id} value={r.id}>
                      v{r.version} {r.published ? '(published)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <Textarea
            value={surveyJson}
            onChange={(e) => setSurveyJson(e.target.value)}
            className="min-h-[220px] bg-[var(--color-brand-bg)] border-[var(--color-brand-border)] text-white font-mono-numbers text-[11px]"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={surveyBusy || !sessionPin || !surveyEditId}
              onClick={async () => {
                setPlatformMessage('')
                let parsed: unknown
                try {
                  parsed = JSON.parse(surveyJson)
                } catch {
                  setPlatformMessage('Invalid JSON')
                  return
                }
                setSurveyBusy(true)
                try {
                  const res = await fetch('/api/admin/survey', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin: sessionPin, op: 'update', id: surveyEditId, config: parsed }),
                  })
                  const data = await res.json()
                  if (!res.ok) {
                    setPlatformMessage(data.error || 'Save failed')
                    return
                  }
                  setPlatformMessage('Survey config saved.')
                  setSurveyRows((prev) =>
                    prev.map((r) => (r.id === surveyEditId ? { ...r, config: parsed } : r))
                  )
                } catch {
                  setPlatformMessage('Network error')
                } finally {
                  setSurveyBusy(false)
                }
              }}
              className="text-xs px-3 py-2 rounded-xl bg-[var(--color-brand-red)] text-white font-semibold disabled:opacity-50"
            >
              {surveyBusy ? 'Saving…' : 'Save config'}
            </button>
            <button
              type="button"
              disabled={surveyBusy || !sessionPin || !surveyEditId}
              onClick={async () => {
                setPlatformMessage('')
                setSurveyBusy(true)
                try {
                  const res = await fetch('/api/admin/survey', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin: sessionPin, op: 'publish', id: surveyEditId }),
                  })
                  const data = await res.json()
                  if (!res.ok) {
                    setPlatformMessage(data.error || 'Publish failed')
                    return
                  }
                  setPlatformMessage('Published selected survey version.')
                  const res2 = await fetch('/api/admin/survey', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin: sessionPin, op: 'list' }),
                  })
                  const data2 = await res2.json()
                  if (res2.ok) setSurveyRows(data2.rows ?? [])
                } catch {
                  setPlatformMessage('Network error')
                } finally {
                  setSurveyBusy(false)
                }
              }}
              className="text-xs px-3 py-2 rounded-xl border border-[var(--color-brand-border)] text-white hover:bg-[var(--color-brand-elevated)] disabled:opacity-50"
            >
              Publish selected
            </button>
          </div>
        </section>

        {/* Server Info */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-5 h-5 text-[var(--color-brand-red)]" />
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
              Server
            </h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--color-brand-text-secondary)]">Environment</span>
              <span className="text-sm font-mono-numbers text-white">{config?.environment || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-[var(--color-brand-border)]">
              <span className="text-sm text-[var(--color-brand-text-secondary)]">App URL</span>
              <span className="text-sm font-mono-numbers text-white">{config?.appUrl || '—'}</span>
            </div>
          </div>
        </section>

        {/* Help */}
        <section className="glass-card rounded-2xl p-5">
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-3">
            Configuration Guide
          </h2>
          <div className="text-xs text-[var(--color-brand-text-muted)] space-y-2">
            <p>All admin configuration is managed via environment variables in <code className="text-[var(--color-brand-red)]">.env.local</code>:</p>
            <div className="p-3 rounded-lg bg-[var(--color-brand-bg)] font-mono-numbers space-y-1 text-[11px]">
              <p><span className="text-[var(--color-brand-text-secondary)]">GEMINI_API_KEY</span>=<span className="text-[var(--color-brand-green)]">your_key_here</span></p>
              <p><span className="text-[var(--color-brand-text-secondary)]">ADMIN_PIN</span>=<span className="text-[var(--color-brand-green)]">your_pin</span></p>
              <p className="text-[var(--color-brand-text-muted)] pt-1 border-t border-[var(--color-brand-border)] mt-2">Supabase (multi-user):</p>
              <p><span className="text-[var(--color-brand-text-secondary)]">NEXT_PUBLIC_SUPABASE_URL</span></p>
              <p><span className="text-[var(--color-brand-text-secondary)]">NEXT_PUBLIC_SUPABASE_ANON_KEY</span></p>
              <p><span className="text-[var(--color-brand-text-secondary)]">SUPABASE_SERVICE_ROLE_KEY</span> <span className="text-[var(--color-brand-text-muted)]">(server only)</span></p>
              <p className="text-[var(--color-brand-text-muted)] pt-1 border-t border-[var(--color-brand-border)] mt-2">
                Optional throttling (override Admin file / serverless):
              </p>
              <p><span className="text-[var(--color-brand-text-secondary)]">AI_RATE_LIMITING_ENABLED</span>=<span className="text-[var(--color-brand-green)]">true|false</span></p>
              <p><span className="text-[var(--color-brand-text-secondary)]">AI_RATE_LIMIT_MAX</span>=<span className="text-[var(--color-brand-green)]">15</span></p>
              <p><span className="text-[var(--color-brand-text-secondary)]">AI_RATE_LIMIT_WINDOW_MS</span>=<span className="text-[var(--color-brand-green)]">60000</span></p>
            </div>
            <p>After changing env vars, restart the server for changes to take effect.</p>
          </div>
        </section>
      </div>
    </div>
  )
}
