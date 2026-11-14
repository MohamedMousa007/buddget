'use client'

import { ResolveRow, ResolveSheet, ResolveTile } from '@/components/modals/ResolveSheet'
import { Button } from '@/components/ui/button'
import { useActionToast } from '@/components/ui/ActionToast'
import { useT } from '@/lib/i18n'
import { useShortDate } from '@/hooks/useShortDate'
import { formatFlex } from '@/lib/utils/formatters'
import { applyPassThrough, countPassThrough, countPassThroughCredit, type ExcludedPair } from '@/lib/spending/passThrough'

/** Lists the pairs a past "yes" left out of income and spending, with one "Count it" per pair. */
export function PassThroughReviewSheet({ open, onClose, pairs }: { open: boolean; onClose: () => void; pairs: ExcludedPair[] }) {
  const t = useT()
  const shortDate = useShortDate()
  const toast = useActionToast()
  const count = (p: ExcludedPair) => {
    if (!p.expense) {
      countPassThroughCredit(p.income.id)
      toast(t.prompts.passThroughCounted)
      return
    }
    const pair = { expenseId: p.expense.id, incomeId: p.income.id }
    countPassThrough([pair])
    toast(t.prompts.passThroughCounted, { undoLabel: t.common.undo, undo: () => void applyPassThrough([pair]) })
  }
  return (
    <ResolveSheet
      open={open}
      onClose={onClose}
      title={t.prompts.passThroughReviewTitle(pairs.length)}
      subtitle={t.prompts.passThroughReviewSub}
      primary={{ label: t.common.done, onPress: onClose }}
    >
      {pairs.map((p) => {
        const amount = `${formatFlex(p.income.amount)} ${String(p.income.currency)}`
        return (
          <ResolveRow
            key={p.income.id}
            state="plain"
            leading={<ResolveTile label={p.income.name} moneyIn />}
            title={p.expense ? `${p.income.name} / ${p.expense.description}` : p.income.name}
            sub={`+${amount} ${shortDate(p.income.receivedDate)}${p.expense ? `, −${amount} ${shortDate(p.expense.date.slice(0, 10))}` : ''}`}
            trailing={
              <Button variant="link" size="touch" onClick={() => count(p)}>
                {t.prompts.passThroughCountIt}
              </Button>
            }
          />
        )
      })}
    </ResolveSheet>
  )
}
