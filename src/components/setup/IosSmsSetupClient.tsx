'use client'

import { useState } from 'react'
import { Copy, Eye, EyeOff, Check } from 'lucide-react'

interface IosSmsSetupClientProps {
  token: string | null
  parseEndpoint: string
  ingestEndpoint: string
}

export function IosSmsSetupClient({ token, parseEndpoint, ingestEndpoint }: IosSmsSetupClientProps) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const masked = token ? `${token.slice(0, 6)}••••••••${token.slice(-4)}` : ''

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* ignore */
    }
  }

  if (!token) {
    return (
      <div className="mt-6 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 p-4 text-sm text-[var(--color-brand-text-muted)]">
        We couldn’t generate a setup token for your account. Reload the page or check
        your network connection.
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-[var(--color-brand-text-muted)]">
            Your bearer token
          </p>
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {revealed ? 'Hide' : 'Reveal'}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded-md bg-[var(--color-brand-card)] px-2 py-1.5 font-mono text-xs">
            {revealed ? token : masked}
          </code>
          <button
            type="button"
            onClick={() => void copy('token', token)}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-brand-border)] px-2 py-1.5 text-xs hover:bg-[var(--color-brand-elevated)]"
          >
            {copied === 'token' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === 'token' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-brand-text-muted)]">
          Treat this like a password — anyone with it can post SMS to your account.
        </p>
      </div>

      <Endpoint label="AI parse endpoint" url={parseEndpoint} onCopy={(v) => void copy('parse', v)} copied={copied === 'parse'} />
      <Endpoint label="Regex ingest endpoint" url={ingestEndpoint} onCopy={(v) => void copy('ingest', v)} copied={copied === 'ingest'} />
    </div>
  )
}

function Endpoint({ label, url, onCopy, copied }: { label: string; url: string; onCopy: (v: string) => void; copied: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 p-3">
      <p className="text-xs uppercase tracking-wide text-[var(--color-brand-text-muted)]">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 truncate rounded-md bg-[var(--color-brand-card)] px-2 py-1.5 font-mono text-xs">{url}</code>
        <button
          type="button"
          onClick={() => onCopy(url)}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-brand-border)] px-2 py-1.5 text-xs hover:bg-[var(--color-brand-elevated)]"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
