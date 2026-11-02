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
import { parentAccountFor } from '@/lib/accounts/parentAccount'
import { withAlias } from '@/lib/accounts/identity/accountRef'
import { useReattribute } from '@/lib/accounts/useReattribute'
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
  const [linkFor, setLinkFor] = useState<{ key: string; last4: string } | null>(null)
  const openAddPaymentMethodWithPrefill = useSettingsStore((s) => s.openAddPaymentMethodWithPrefill)
  const openAddAccountWithPrefill = useSettingsStore((s) => s.openAddAccountWithPrefill)
  const router = useRouter()
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)

  useRegisterPrompts(
    'account-detection',
    detected.map(({ key, last4, provider, type, currency, count }): Prompt => {
      const add = addFor(type, t.prompts, t.accountsPage.addAccount)
      return {
        key,
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
                openAddAccountWithPrefill({ provider: provider ?? '', last4, ...(currency ? { currency } : {}) })
                router.push('/accounts')
              } else {
                const parentId = type === 'debit_card' || type === null ? parentAccountFor(paymentMethods, provider) : undefined
                openAddPaymentMethodWithPrefill({ name: provider ?? '', last4, ...(type ? { type } : {}), ...(parentId ? { parentId } : {}), ...(currency ? { currency } : {}) })
              }
            },
          },
          { label: t.prompts.linkExisting, variant: 'secondary', onPress: () => setLinkFor({ key, last4 }) },
          { label: t.prompts.notMine, variant: 'secondary', onPress: () => settlePrompt(key) },
        ],
      }
    }),
  )

  return <LinkExistingSheet link={linkFor} onClose={() => setLinkFor(null)} />
}

/** "Link existing": the payment-method select, in a sheet, that stamps the detected last4. */
function LinkExistingSheet({ link, onClose }: { link: { key: string; last4: string } | null; onClose: () => void }) {
  const last4 = link?.last4 ?? null
  const t = useT()
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)
  const reattribute = useReattribute()
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
            if (!link || !choice) return
            const target = paymentMethods.find((pm) => pm.id === choice)
            if (target) updatePaymentMethod(choice, withAlias(target, link.last4))
            void reattribute(choice, link.last4)
            settlePrompt(link.key)
            close()
          }}
        >
          {t.settings.linkCta}
        </Button>
      </div>
    </ModalShell>
  )
}
