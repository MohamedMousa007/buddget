'use client'

import { Sparkles } from 'lucide-react'
import { usePwaUpdate } from '@/hooks/usePwaUpdate'
import { useT } from '@/lib/i18n'
import { PROMPT_PRIORITY, useRegisterPrompts, type Prompt } from '@/lib/store/usePromptStore'

/** "A new version is ready" is a question, so it is a card in the shared prompt stack, not a surface of its own. */
export function UpdatePrompt() {
  const { updateAvailable, applyUpdate, dismiss } = usePwaUpdate()
  const t = useT()
  const prompts: Prompt[] = updateAvailable
    ? [
        {
          key: 'pwaUpdate',
          priority: PROMPT_PRIORITY.update,
          tone: 'brand',
          icon: Sparkles,
          title: t.pwa.updateTitle,
          description: t.pwa.updateSubtitle,
          actions: [
            { label: t.pwa.updateRefresh, variant: 'default', onPress: applyUpdate },
            { label: t.pwa.updateNotNow, variant: 'secondary', onPress: dismiss },
          ],
        },
      ]
    : []
  useRegisterPrompts('pwaUpdate', prompts)
  return null
}
