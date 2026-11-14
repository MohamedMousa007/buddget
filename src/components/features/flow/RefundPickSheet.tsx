'use client'

import { useMemo } from 'react'
import { ResolveRow, ResolveSheet, ResolveTile } from '@/components/modals/ResolveSheet'
import { Button } from '@/components/ui/button'
import { useActionToast } from '@/components/ui/ActionToast'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { useShortDate } from '@/hooks/useShortDate'
import { formatFlex } from '@/lib/utils/formatters'
import { refundCandidates } from '@/lib/sms/flagPrompts'
import { matchRefundToPurchase } from '@/lib/sms/flagActions'
import type { Expense } from '@/lib/store/types'

/** Lists the purchases a refund with no matched purchase could have returned, with one "Choose" per purchase. */
export function RefundPickSheet({ refund, onClose }: { refund: Expense | null; onClose: () => void }) {
  const t = useT()
  const copy = t.prompts.smsFlags
  const shortDate = useShortDate()
  const toast = useActionToast()
  const expenses = useFinanceStore((s) => s.expenses)
  const candidates = useMemo(() => (refund ? refundCandidates(expenses, refund) : []), [expenses, refund])

  const choose = async (purchase: Expense) => {
    if (!refund) return
    const ok = await matchRefundToPurchase(refund.id, purchase.id)
    toast(ok ? copy.pickDone : copy.failed)
    if (ok) onClose()
  }

  return (
    <ResolveSheet
      open={refund !== null}
      onClose={onClose}
      title={copy.pickTitle}
      subtitle={candidates.length ? copy.pickSub : copy.pickEmpty}
      primary={{ label: copy.pickClose, onPress: onClose }}
    >
      {candidates.map((e) => (
        <ResolveRow
          key={e.id}
          state="plain"
          leading={<ResolveTile label={e.description} />}
          title={e.description}
          sub={`−${formatFlex(e.amount)} ${e.currency} · ${shortDate(e.date.slice(0, 10))}`}
          trailing={
            <Button variant="link" size="touch" onClick={() => void choose(e)}>
              {copy.pickRow}
            </Button>
          }
        />
      ))}
    </ResolveSheet>
  )
}
