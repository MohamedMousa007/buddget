'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { ResolveSheet } from '@/components/modals/ResolveSheet'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/SelectField'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useActionToast } from '@/components/ui/ActionToast'
import { TOAST_UNDO_MS } from '@/components/ui/toastQueue'
import { useDetectedAccounts } from '@/hooks/useDetectedAccounts'
import type { DetectedAccount } from '@/hooks/usePaymentMethodDetector'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { settlePrompt } from '@/lib/prompts/settle'
import { navigate } from '@/lib/navigation/navigate'
import { createDeferred } from '@/lib/sms/heldReview'
import { PAYMENT_BRANDS, PAYMENT_TYPE_META, QUICK_ADD, composePaymentMethodName, resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import { parentAccountFor } from '@/lib/accounts/parentAccount'
import { withAlias } from '@/lib/accounts/identity/accountRef'
import { useReattribute } from '@/lib/accounts/useReattribute'
import { ProviderPickerSheet } from '@/components/features/payments/ProviderPickerSheet'
import { confirmProvisional, confirmProvisionalWithBank, isBankless, mergeProvisional, provisionalIdOf, rejectProvisional } from '@/lib/accounts/provisional'
import { BrandMark } from './BrandMark'

const BANK_FIRST = [...QUICK_ADD.EG, ...QUICK_ADD.SA]

type Step = { key: string; mode: 'actions' | 'link' } | null

const titleOf = (a: DetectedAccount) => `${a.provider ? `${a.provider} ` : ''}••${a.last4}`

/**
 * Every account, card and wallet the bank messages mention that no payment method owns yet, one row each. A row opens
 * its own three answers (Add, Link existing, Not mine) and there is no bulk path. A provisional account (one the server
 * created from a message that gave bank, digits and currency) is listed first with the same three answers: Keep it,
 * Link existing (merge: its history moves over) or Not mine, each with Undo. The count here, on the Accounts row, on the avatar dot and in the Inbox all come from `useDetectedAccounts`.
 */
export function DetectedAccountsSheet({ open, onClose, onManual }: { open: boolean; onClose: () => void; onManual: () => void }) {
  const all = useT()
  const t = all.accountsPage
  const toast = useActionToast()
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)
  const openAddPaymentMethodWithPrefill = useSettingsStore((s) => s.openAddPaymentMethodWithPrefill)
  const openAddAccountWithPrefill = useSettingsStore((s) => s.openAddAccountWithPrefill)
  const reattribute = useReattribute()
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<Step>(null)
  const [choice, setChoice] = useState('')
  const [bankPick, setBankPick] = useState<DetectedAccount | null>(null)
  const list = useDetectedAccounts(hidden)

  // "Not mine" is permanent and synced, so it is held back for the Undo window and sent then; leaving flushes it.
  const [deferred] = useState(() => createDeferred(async (keys) => { keys.forEach(settlePrompt) }, TOAST_UNDO_MS))
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') void deferred.flush() }
    const flushNow = () => void deferred.flush()
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', flushNow)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('pagehide', flushNow)
      void deferred.flush()
    }
  }, [deferred])

  const current = step ? list.find((a) => a.key === step.key) : undefined
  const close = () => {
    setStep(null)
    setChoice('')
    onClose()
  }
  const back = () => {
    setStep(null)
    setChoice('')
  }
  // The row just answered leaves the list; with none left there is nothing to show.
  const done = () => {
    if (list.length <= 1) close()
    else back()
  }

  const withUndo = (message: string, undo: () => void) => toast(message, { undoLabel: all.common.undo, undo })
  const add = (a: DetectedAccount) => {
    const provisionalId = provisionalIdOf(a.key)
    if (provisionalId) {
      if (isBankless({ name: composePaymentMethodName(a.provider ?? '', { last4: a.last4 }), last4: a.last4 })) {
        setBankPick(a)
        return
      }
      withUndo(t.keptToast(titleOf(a)), confirmProvisional(provisionalId))
      // Earlier messages that named these digits before the account existed move onto it too.
      void reattribute(provisionalId, a.last4)
      done()
      return
    }
    const { provider, last4, type, currency } = a
    close()
    if (type === 'bank_account') {
      openAddAccountWithPrefill({ provider: provider ?? '', last4, ...(currency ? { currency } : {}) })
      navigate('/accounts')
    } else {
      const parentId = type === 'debit_card' || type === null ? parentAccountFor(paymentMethods, provider) : undefined
      openAddPaymentMethodWithPrefill({ name: provider ?? '', last4, ...(type ? { type } : {}), ...(parentId ? { parentId } : {}), ...(currency ? { currency } : {}) })
    }
  }
  const pickBank = (brandKey: string) => {
    const a = bankPick
    const provisionalId = a && provisionalIdOf(a.key)
    setBankPick(null)
    if (!a || !provisionalId) return
    const undo = confirmProvisionalWithBank(provisionalId, brandKey)
    if (!undo) return
    withUndo(t.keptToast(`${PAYMENT_BRANDS[brandKey].name} ••${a.last4}`), undo)
    void reattribute(provisionalId, a.last4)
    done()
  }
  const link = (a: DetectedAccount) => {
    const target = paymentMethods.find((pm) => pm.id === choice)
    if (!target) return
    const provisionalId = provisionalIdOf(a.key)
    if (provisionalId) {
      const undo = mergeProvisional(provisionalId, choice)
      if (!undo) return
      withUndo(t.reattached(a.count), undo)
      done()
      return
    }
    updatePaymentMethod(choice, withAlias(target, a.last4))
    void reattribute(choice, a.last4)
    settlePrompt(a.key)
    done()
  }
  const notMine = (a: DetectedAccount) => {
    const provisionalId = provisionalIdOf(a.key)
    if (provisionalId) {
      withUndo(t.hiddenToast(titleOf(a)), rejectProvisional(provisionalId))
      done()
      return
    }
    const handle = deferred.schedule([a.key])
    setHidden((h) => new Set([...h, a.key]))
    toast(t.hiddenToast(titleOf(a)), {
      undoLabel: all.common.undo,
      undo: () => {
        if (handle.cancel()) setHidden((h) => new Set([...h].filter((k) => k !== a.key)))
      },
    })
    done()
  }

  const addLabel = (a: DetectedAccount) => provisionalIdOf(a.key) ? t.keepAccount : (a.type === 'bank_account' ? t.addAccount : a.type === 'wallet' ? all.prompts.addWallet : all.prompts.addCard)
  const empty = list.length === 0 && !step

  // The three views of one sheet: the list, one account's answers, and the "link to…" choice.
  let title = list.length > 0 ? t.accountsCount(list.length) : t.findMyAccounts
  let subtitle: string | undefined = list.length > 0 ? t.detectedSub : undefined
  let primary: { label: string; onPress: () => void; disabled?: boolean } = empty
    ? { label: t.addOneMyself, onPress: () => { close(); onManual() } }
    : { label: all.common.close, onPress: close }
  let secondary: { label: string; onPress: () => void; disabled?: boolean } | undefined
  let body: ReactNode = null

  if (step && current) {
    if (step.mode === 'actions') {
      title = titleOf(current)
      subtitle = provisionalIdOf(current.key) ? t.provisionalPick : t.detectedPick
      primary = { label: addLabel(current), onPress: () => add(current) }
      secondary = { label: all.prompts.linkExisting, onPress: () => setStep({ key: current.key, mode: 'link' }), disabled: paymentMethods.length === 0 }
      body = (
        <>
          <Button variant="ghost" size="touch" className="w-full justify-center font-semibold text-[var(--color-brand-red)]" onClick={() => notMine(current)}>
            {all.prompts.notMine}
          </Button>
          <p className="text-center text-xs text-[var(--color-brand-text-secondary)]">{provisionalIdOf(current.key) ? t.provisionalNotMineNote : t.notMineNote}</p>
        </>
      )
    } else {
      title = `${all.prompts.linkExisting} · ••${current.last4}`
      subtitle = t.linkNote(current.last4)
      primary = { label: all.settings.linkCta, onPress: () => link(current), disabled: !choice }
      secondary = { label: all.common.back, onPress: () => setStep({ key: current.key, mode: 'actions' }) }
      body = (
        <SelectField
          value={choice}
          onChange={setChoice}
          placeholder={all.settings.linkToExisting}
          aria-label={all.settings.linkToExisting}
          items={paymentMethods.filter((pm) => !pm.provisional).map((pm) => ({ value: pm.id, label: pm.name }))}
        />
      )
    }
  } else if (list.length > 0) {
    body = list.map((a) => {
      const color = PAYMENT_BRANDS[resolvePaymentBrandKey(a.provider ?? '') ?? '']?.colors[0] ?? PAYMENT_TYPE_META.bank_account.color
      return (
        <SelectableCard key={a.key} as="action" layout="row" aria-label={`${titleOf(a)}. ${provisionalIdOf(a.key) ? t.provisionalBody(a.count) : all.prompts.acctBody(a.count)}`} onClick={() => setStep({ key: a.key, mode: 'actions' })} className="h-auto min-h-[56px] py-2.5">
          <BrandMark name={a.provider ?? 'Bank'} color={color} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]" dir="auto">{titleOf(a)}</span>
            <span className="block text-xs text-[var(--color-brand-text-secondary)]">{provisionalIdOf(a.key) ? t.provisionalBody(a.count) : all.prompts.acctBody(a.count)}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-secondary)] rtl:rotate-180" aria-hidden />
        </SelectableCard>
      )
    })
  } else {
    body = <p className="py-6 text-center text-sm text-[var(--color-brand-text-secondary)]">{t.detectedNone}</p>
  }

  return (
    <ResolveSheet open={open} onClose={step ? back : close} title={title} subtitle={subtitle} primary={primary} secondary={secondary}>
      {body}
      <ProviderPickerSheet
        open={bankPick !== null}
        selectedId={null}
        popularIds={BANK_FIRST}
        issuesType={bankPick?.type === 'wallet' ? 'wallet' : 'bank_account'}
        onPick={pickBank}
        onCustom={() => setBankPick(null)}
        onClose={() => setBankPick(null)}
      />
    </ResolveSheet>
  )
}
