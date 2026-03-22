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
} from 'lucide-react'
import { Input } from '@/components/ui/input'
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
