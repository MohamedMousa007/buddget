'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Tag } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { PROMPT_PRIORITY, useRegisterPrompts, type Prompt } from '@/lib/store/usePromptStore'
import { settlePrompt } from '@/lib/prompts/settle'
import { merchantAnsweredKey, merchantPromptKey, unknownMerchants } from '@/lib/spending/merchantCategory'
import { formatFlex } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'

/** Fewest purchases at an unknown merchant before it is worth a question. */
const MIN_PURCHASES = 2

/**
 * Asks once per unknown merchant what kind of place it is. The answer is given in the existing expense sheet (its
 * category grid): saving a category there files the merchant's other uncategorised purchases too and teaches the
 * server for later ones. Either answer is remembered, so a merchant is never asked about twice.
 */
export function MerchantCategoryPrompt() {
  const t = useT()
  const { expenses, promptState } = useFinanceStore(useShallow((s) => ({ expenses: s.expenses, promptState: s.settings.promptState })))
  const { setActiveModal, setEditingExpenseId } = useSettingsStore(
    useShallow((s) => ({ setActiveModal: s.setActiveModal, setEditingExpenseId: s.setEditingExpenseId })),
  )
  const merchant = useMemo(() => unknownMerchants(expenses, promptState).find((m) => m.ids.length >= MIN_PURCHASES), [expenses, promptState])

  const prompts: Prompt[] = []
  if (merchant) {
    const key = merchantPromptKey(merchant.key)
    prompts.push({
      key,
      priority: Math.max(...Object.values(PROMPT_PRIORITY)),
      tone: 'brand',
      icon: Tag,
      title: t.prompts.merchantCategoryTitle(merchant.name),
      description: t.prompts.merchantCategoryBody(merchant.ids.length, `${formatFlex(merchant.total)} ${merchant.currency}`),
      actions: [
        {
          label: t.prompts.merchantCategoryChoose,
          variant: 'default',
          onPress: () => {
            settlePrompt(key)
            // Counted apart from "Not now", so the share of questions that get answered is known.
            settlePrompt(merchantAnsweredKey(merchant.key))
            setEditingExpenseId(merchant.ids[0])
            setActiveModal('editExpense')
          },
        },
        { label: t.prompts.merchantCategoryLater, variant: 'secondary', onPress: () => settlePrompt(key) },
      ],
    })
  }
  useRegisterPrompts('merchantCategory', prompts)
  return null
}
