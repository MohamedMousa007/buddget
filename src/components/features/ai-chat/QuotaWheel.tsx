'use client'

import { intlTag } from '@/lib/i18n/dateFormat'
import { useState } from 'react'
import { useBuddgyUsage } from '@/hooks/useBuddgyUsage'
import { useDismissable } from '@/hooks/useDismissable'
import { summarizeUsage } from '@/lib/buddgy/client/usage'
import { useBuddgyChatCopy } from '@/lib/i18n/buddgyChatCopy'
import { useLocale } from '@/lib/i18n'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'
import { ProgressRing } from '@/components/ui/ProgressRing'

const arcFor = (pct: number) => (pct >= 90 ? 'var(--color-brand-red)' : pct >= 70 ? 'var(--color-brand-amber)' : 'var(--color-brand-green)')

/** Claude-style usage wheel beside the send button: the tightest limit as a ring, every limit on tap. */
export function QuotaWheel({ refreshKey }: { refreshKey: string }) {
  const copy = useBuddgyChatCopy().usage
  const { locale } = useLocale()
  const status = useBuddgyUsage(refreshKey)
  const [open, setOpen] = useState(false)
  useDismissable(open, () => setOpen(false))
  if (!status) return null
  const { rows, pct } = summarizeUsage(status)
  const at = (iso: string) => new Date(iso).toLocaleTimeString(intlTag(locale), { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="relative shrink-0">
      <IconButton variant="ghost" size="md" aria-label={copy.aria(pct)} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <ProgressRing pct={pct} size={26} stroke={3} arc={arcFor(pct)} />
      </IconButton>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <Card variant="elevated" padding="md" className="absolute bottom-full end-0 z-20 mb-2 flex w-64 flex-col gap-3">
            <p className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{copy.title}</p>
            {rows.map((r) => (
              <div key={r.key} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-[var(--color-brand-text-primary)]">{copy.rows[r.key]}</span>
                  <span className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">
                    {r.pct == null ? copy.unlimited : copy.percentUsed(r.pct)}
                  </span>
                </div>
                {r.pct != null ? (
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-brand-border)]">
                    <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: arcFor(r.pct) }} />
                  </div>
                ) : null}
                {r.resetAt && r.pct != null && r.pct >= 70 ? (
                  <span className="text-xs text-[var(--color-brand-text-muted)]">{copy.resets(at(r.resetAt))}</span>
                ) : null}
              </div>
            ))}
          </Card>
        </>
      ) : null}
    </div>
  )
}
