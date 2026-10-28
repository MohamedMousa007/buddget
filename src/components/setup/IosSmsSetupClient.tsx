'use client'

import { useState } from 'react'
import { Copy, Eye, EyeOff, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'

interface IosSmsSetupClientProps {
  token: string | null
  parseEndpoint: string
  ingestEndpoint: string
}

export function IosSmsSetupClient({ token, parseEndpoint, ingestEndpoint }: IosSmsSetupClientProps) {
  const t = useT().systemPages.iosSmsSetup
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
        {t.tokenMissing}
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-[var(--color-brand-text-muted)]">
            {t.bearerToken}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRevealed((v) => !v)}
            aria-pressed={revealed}
            className="text-xs text-[var(--color-brand-text-secondary)]"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {revealed ? t.hide : t.reveal}
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded-md bg-[var(--color-brand-card)] px-2 py-1.5 font-mono text-xs">
            {revealed ? token : masked}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void copy('token', token)}
            className="text-xs"
          >
            {copied === 'token' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === 'token' ? t.copied : t.copy}
          </Button>
        </div>
        <p className="mt-2 text-xs text-[var(--color-brand-text-muted)]">
          {t.tokenWarning}
        </p>
      </div>

      <Endpoint label={t.parseEndpoint} url={parseEndpoint} onCopy={(v) => void copy('parse', v)} copied={copied === 'parse'} />
      <Endpoint label={t.ingestEndpoint} url={ingestEndpoint} onCopy={(v) => void copy('ingest', v)} copied={copied === 'ingest'} />
    </div>
  )
}

function Endpoint({ label, url, onCopy, copied }: { label: string; url: string; onCopy: (v: string) => void; copied: boolean }) {
  const t = useT().systemPages.iosSmsSetup
  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 p-3">
      <p className="text-xs uppercase tracking-wide text-[var(--color-brand-text-muted)]">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 truncate rounded-md bg-[var(--color-brand-card)] px-2 py-1.5 font-mono text-xs">{url}</code>
        <Button variant="outline" size="sm" onClick={() => onCopy(url)} className="text-xs">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? t.copied : t.copy}
        </Button>
      </div>
    </div>
  )
}
