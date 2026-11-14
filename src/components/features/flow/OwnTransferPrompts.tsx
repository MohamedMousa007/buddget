'use client'

import { ArrowLeftRight } from 'lucide-react'
import { PROMPT_PRIORITY, useRegisterPrompts, type Prompt } from '@/lib/store/usePromptStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { formatFlex } from '@/lib/utils/formatters'
import { useShortDate } from '@/hooks/useShortDate'
import { useOwnTransferReview } from '@/hooks/useOwnTransferReview'
import { answerOwnTransfer } from '@/lib/sms/ownTransferActions'
import { settlePrompt } from '@/lib/prompts/settle'
import { useT } from '@/lib/i18n'

/**
 * Registers the server's own-transfer questions with the prompt stack: a middle-evidence pair is asked about, and a
 * pair the server already booked as a transfer says so with an Undo. Not tied to a Flow segment.
 */
export function OwnTransferPrompts() {
  const t = useT()
  const shortDate = useShortDate()
  const { asks, settled, refresh } = useOwnTransferReview()
  const dismissed = useSettingsStore((s) => s.dismissedBanners)

  const describe = (r: { amount: number | null; currency: string | null; received_at: string }) =>
    `${formatFlex(r.amount ?? 0)} ${r.currency ?? ''}`.trim() + ` · ${shortDate(r.received_at)}`

  const prompts: Prompt[] = []
  const ask = asks[0]
  if (ask) {
    const answer = (action: 'confirm' | 'decline') => () => void answerOwnTransfer(ask.id, action).then(refresh)
    prompts.push({
      key: `owntransfer:ask:${ask.id}`,
      priority: PROMPT_PRIORITY.sms,
      tone: 'brand',
      icon: ArrowLeftRight,
      title: t.prompts.ownTransferAskTitle,
      description: t.prompts.ownTransferAskBody(describe(ask)),
      actions: [
        { label: t.prompts.ownTransferYes, variant: 'default', onPress: answer('confirm') },
        { label: t.prompts.ownTransferNo, variant: 'secondary', onPress: answer('decline') },
      ],
    })
  }
  const done = settled.find((r) => !dismissed.includes(`owntransfer:settled:${r.id}`))
  if (done) {
    const key = `owntransfer:settled:${done.id}`
    prompts.push({
      key,
      priority: PROMPT_PRIORITY.sms,
      tone: 'positive',
      icon: ArrowLeftRight,
      title: t.prompts.ownTransferSettledTitle,
      description: t.prompts.ownTransferSettledBody(describe(done)),
      actions: [
        {
          label: t.common.undo,
          variant: 'secondary',
          onPress: () =>
            void answerOwnTransfer(done.id, 'undo').then((ok) => {
              if (ok) settlePrompt(key)
              return refresh()
            }),
        },
        { label: t.prompts.ownTransferOk, variant: 'default', onPress: () => settlePrompt(key) },
      ],
    })
  }
  useRegisterPrompts('ownTransfer', prompts)
  return null
}
