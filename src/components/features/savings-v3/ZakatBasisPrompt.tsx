'use client'

import { Moon } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { PROMPT_PRIORITY, useRegisterPrompts, type Prompt } from '@/lib/store/usePromptStore'
import { withNisabBasis, zakatBasisChosen } from '@/lib/savings/zakatBasis'
import { useT } from '@/lib/i18n'

export interface ZakatBasisPromptProps {
  /** Where the user stands against the two lines — drives the one-line sub. */
  context: 'none' | 'silverOnly' | 'both'
  silverNisab: string
  goldNisab: string
  /** Called after the choice is saved. */
  onPick?: (basis: 'silver' | 'gold') => void
}

/**
 * Registers the one-time "silver or gold?" question with the drop-down prompt stack.
 * Renders nothing itself; mount once on Wealth. It disappears for good as soon as the
 * basis is saved (`nisabBasisChosen`), and until then zakat is computed on gold.
 */
export function ZakatBasisPrompt({ context, silverNisab, goldNisab, onPick }: ZakatBasisPromptProps) {
  const t = useT().wealthSheets.zakatPrompt
  const cfg = useFinanceStore((s) => s.profile.zakatConfig)
  const updateProfile = useFinanceStore((s) => s.updateProfile)

  const pick = (basis: 'silver' | 'gold') => {
    const current = useFinanceStore.getState().profile.zakatConfig
    updateProfile({ zakatConfig: withNisabBasis(current, basis) })
    onPick?.(basis)
  }

  const sub = context === 'silverOnly' ? t.subSilverOnly : context === 'both' ? t.subBoth : t.subNone
  const prompts: Prompt[] = zakatBasisChosen(cfg)
    ? []
    : [
        {
          key: 'zakat-basis',
          priority: PROMPT_PRIORITY.planChange + 10,
          tone: 'brand',
          icon: Moon,
          title: t.title,
          description: `${sub} ${t.hadith} ${t.hadithSource} ${t.jurists} ${t.nisabLine(silverNisab, goldNisab)}`,
          actions: [
            { label: t.silver, variant: 'default', onPress: () => pick('silver') },
            { label: t.gold, variant: 'secondary', onPress: () => pick('gold') },
          ],
        },
      ]
  useRegisterPrompts('zakat-basis', prompts)
  return null
}
