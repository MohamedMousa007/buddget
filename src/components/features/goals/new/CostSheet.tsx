'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalTitle } from '@/components/modals/ModalTitle'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { BuddgyStatus } from '@/components/features/goals/new/BuddgyStatus'
import { useT } from '@/lib/i18n'
import { estimateGoalCost, type CostEstimate } from '@/lib/goals/goalAi'
import { formatCurrency } from '@/lib/utils/formatters'

/** Buddgy's typical-cost helper: three priced options, one tap fills the target. Fails to a retry line. */
export function CostSheet({
  open,
  name,
  categoryLabel,
  currency,
  onUse,
  onClose,
}: {
  open: boolean
  name: string
  categoryLabel: string
  currency: string
  onUse: (amount: number) => void
  onClose: () => void
}) {
  const ts = useT().goals.flow
  const t = ts.cost
  const tc = useT().common
  const [res, setRes] = useState<{ key: string; est?: CostEstimate; failed?: boolean } | null>(null)
  const [picked, setPicked] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const key = `${name}|${categoryLabel}|${currency}|${attempt}`
  const cur = res?.key === key ? res : null
  const est = cur?.est ?? null
  const failed = Boolean(cur?.failed)

  useEffect(() => {
    if (!open) return
    const ctrl = new AbortController()
    // A reply that never comes becomes a retry prompt instead of an endless spinner.
    const giveUp = setTimeout(() => {
      ctrl.abort()
      setRes({ key, failed: true })
    }, 30_000)
    estimateGoalCost({ name, category: categoryLabel, currency }, ctrl.signal)
      .then((e) => {
        setRes({ key, est: e })
        setPicked(Math.min(1, e.options.length - 1))
      })
      .catch(() => !ctrl.signal.aborted && setRes({ key, failed: true }))
      .finally(() => clearTimeout(giveUp))
    return () => {
      clearTimeout(giveUp)
      ctrl.abort()
    }
  }, [open, name, categoryLabel, currency, key])

  const chosen = est?.options[picked]
  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName="z-[110]" padContent>
      <div className="flex items-center gap-2">
        <BuddgyIcon mood="thinking" size={28} />
        <div className="min-w-0 flex-1">
          <ModalTitle>{t.title}</ModalTitle>
          <p className="text-[11px] text-[var(--color-brand-text-secondary)]">{t.sub(categoryLabel)}</p>
        </div>
        <IconButton aria-label={tc.close} onClick={onClose}>
          <X />
        </IconButton>
      </div>
      <div className="mt-3 flex flex-col gap-3 pb-4">
        <p className="rounded-2xl rounded-es-[4px] bg-[var(--color-brand-elevated)] p-3 text-sm text-[var(--color-brand-text-primary)]">
          {failed ? t.retry : est ? t.bubble : null}
          {!failed && !est ? <BuddgyStatus steps={ts.status.cost} /> : null}
        </p>
        {est ? (
          <div role="radiogroup" aria-label={t.title} className="flex flex-col gap-2">
            {est.options.map((o, i) => (
              <SelectableCard key={o.label} selected={picked === i} onClick={() => setPicked(i)} className="min-h-14 justify-between">
                <span className="text-sm font-semibold">{o.label}</span>
                <span className="font-mono-numbers text-sm">{formatCurrency(o.amount, currency, false)}</span>
              </SelectableCard>
            ))}
            {est.assumption ? <p className="text-xs text-[var(--color-brand-text-secondary)]">{est.assumption}</p> : null}
          </div>
        ) : null}
        {failed ? (
          <Button size="cta-block" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            {t.retryCta}
          </Button>
        ) : (
          <Button
            size="cta-block"
            disabled={!chosen}
            onClick={() => {
              if (chosen) onUse(chosen.amount)
              onClose()
            }}
          >
            {chosen ? t.use(formatCurrency(chosen.amount, currency, false)) : t.loading}
          </Button>
        )}
      </div>
    </ModalShell>
  )
}
