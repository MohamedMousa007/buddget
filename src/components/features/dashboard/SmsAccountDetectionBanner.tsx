'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Landmark, Wallet, type LucideIcon } from 'lucide-react'
import { usePaymentMethodDetector, type DetectedAccount } from '@/hooks/usePaymentMethodDetector'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { settlePrompt } from '@/lib/prompts/settle'
import { PROMPT_PRIORITY, useRegisterPrompts, type Prompt } from '@/lib/store/usePromptStore'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalTitle } from '@/components/modals/ModalTitle'
import { SelectField } from '@/components/ui/SelectField'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n'

/** The primary CTA names what will be created, from the type the SMS implies. */
function addFor(type: DetectedAccount['type'], t: Dictionary['prompts'], addAccountLabel: string): { label: string; icon: LucideIcon } {
  if (type === 'wallet') return { label: t.addWallet, icon: Wallet }
  if (type === 'bank_account') return { label: addAccountLabel, icon: Landmark }
  return { label: t.addCard, icon: CreditCard }
}

/**
 * An account seen in bank SMS that no payment method owns yet. Registers `pm:<last4>` with
 * the prompt stack: "Add card/account/wallet" opens the prefilled setup sheet; "Link existing"
 * stamps the last4 onto a method the user already has. Either answer makes the detector drop
 * the account, which resolves the prompt.
 */
export function SmsAccountDetectionBanner() {
  const detected = usePaymentMethodDetector()
  const t = useT()
  const [linkFor, setLinkFor] = useState<string | null>(null)
  const openAddPaymentMethodWithPrefill = useSettingsStore((s) => s.openAddPaymentMethodWithPrefill)
  const openAddAccountWithPrefill = useSettingsStore((s) => s.openAddAccountWithPrefill)
  const router = useRouter()

  useRegisterPrompts(
    'account-detection',
    detected.map(({ last4, provider, type, count }): Prompt => {
      const add = addFor(type, t.prompts, t.accountsPage.addAccount)
      return {
        key: `pm:${last4}`,
        priority: PROMPT_PRIORITY.account,
        tone: 'brand',
        icon: add.icon,
        title: `${provider ? `${provider} ` : ''}••${last4} ${t.settings.accountDetected}`,
        description: t.prompts.acctBody(count),
        actions: [
          {
            label: add.label,
            variant: 'default',
            onPress: () => {
              if (type === 'bank_account') {
                openAddAccountWithPrefill({ provider: provider ?? '', last4 })
                router.push('/accounts')
              } else openAddPaymentMethodWithPrefill({ name: provider ?? '', last4, ...(type ? { type } : {}) })
            },
          },
          { label: t.prompts.linkExisting, variant: 'secondary', onPress: () => setLinkFor(last4) },
          { label: t.prompts.notMine, variant: 'secondary', onPress: () => settlePrompt(`pm:${last4}`) },
        ],
      }
    }),
  )

  return <LinkExistingSheet last4={linkFor} onClose={() => setLinkFor(null)} />
}

/** "Link existing": the payment-method select, in a sheet, that stamps the detected last4. */
function LinkExistingSheet({ last4, onClose }: { last4: string | null; onClose: () => void }) {
  const t = useT()
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)
  const [choice, setChoice] = useState('')
  const close = () => {
    setChoice('')
    onClose()
  }

  return (
    <ModalShell open={last4 !== null} onBackdropClick={close} padContent>
      <div className="flex flex-col gap-3">
        <ModalTitle>
          {t.prompts.linkExisting} · ••{last4}
        </ModalTitle>
        <SelectField
          value={choice}
          onChange={setChoice}
          placeholder={t.settings.linkToExisting}
          aria-label={t.settings.linkToExisting}
          items={paymentMethods.map((pm) => ({ value: pm.id, label: pm.name }))}
        />
        <Button
          size="cta-block"
          disabled={!choice}
          onClick={() => {
            if (!last4 || !choice) return
            updatePaymentMethod(choice, { last4 })
            settlePrompt(`pm:${last4}`)
            close()
          }}
        >
          {t.settings.linkCta}
        </Button>
      </div>
    </ModalShell>
  )
}
