'use client'

import { useEffect, useState } from 'react'
import { User, Pencil } from 'lucide-react'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { AvatarPickerModal } from '@/components/profile/AvatarPickerModal'
import { useShallow } from 'zustand/react/shallow'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Check, ArrowRight, Lock } from 'lucide-react'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT, useLocale } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'

interface FieldRowProps {
  label: string
  value: string
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="border-b border-[#2A2A38] pb-3 mb-3 last:border-0 last:pb-0 last:mb-0">
      <p className="text-xs uppercase tracking-wider text-[#5A5A72]">{label}</p>
      <p className="text-white text-sm mt-0.5">{value || '—'}</p>
    </div>
  )
}

export default function ProfilePage() {
  const t = useT()
  const { locale } = useLocale()
  const { user } = useAuth()
  const store = useFinanceStore()

  useEffect(() => {
    if (user?.email) {
      useFinanceStore.getState().updateProfile({ email: user.email })
    }
  }, [user?.email])

  const [editMode, setEditMode] = useState(false)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', country: '', city: '' })

  const avatarSrc = resolveProfileAvatarSrc(store.profile)
  const displayName = store.profile.name || t.profile.displayNameFallback
  const displayEmail = user?.email || store.profile.email || ''

  const router = useRouter()
  const { signOut } = useAuth()
  const stats = useMonthlyStats()
  const { budgetCategories, incomeSources, expenses, savingsHoldings, paymentMethods } = useFinanceStore(
    useShallow((s) => ({
      budgetCategories: s.budgetCategories,
      incomeSources: s.incomeSources,
      expenses: s.expenses,
      savingsHoldings: s.savingsHoldings,
      paymentMethods: s.paymentMethods,
    }))
  )

  const [resetSent, setResetSent] = useState(false)

  const setupSteps = [
    { label: t.profile.setupStepIncome, done: incomeSources.length > 0, href: '/income' },
    { label: t.profile.setupStepBudget, done: budgetCategories.some((b) => b.budgetedAmount > 0), href: '/#budget' },
    { label: t.profile.setupStepPayment, done: paymentMethods.length > 1, href: '/settings' },
    { label: t.profile.setupStepExpense, done: expenses.length > 0, href: '/expenses' },
    { label: t.profile.setupStepSavings, done: savingsHoldings.length > 0, href: '/savings' },
  ]
  const completedCount = setupSteps.filter((s) => s.done).length

  const setupMessage =
    completedCount === 0
      ? t.profile.setupMsg0
      : completedCount <= 2
        ? t.profile.setupMsg1
        : completedCount <= 4
          ? t.profile.setupMsg3
          : t.profile.setupMsg5

  const handlePasswordReset = async () => {
    const email = user?.email
    if (!email) return
    try {
      const supabase = createClient()
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password/confirm`,
      })
      setResetSent(true)
      setTimeout(() => setResetSent(false), 5000)
    } catch {
      // silently fail
    }
  }

  const handleSignOut = async () => {
    clearBudgetData()
    await signOut()
    router.push('/')
  }

  const enterEditMode = () => {
    setForm({
      name: store.profile.name,
      email: store.profile.email || user?.email || '',
      phone: store.profile.phone || '',
      country: store.profile.country || '',
      city: store.profile.city || '',
    })
    setEditMode(true)
  }

  const discard = () => setEditMode(false)

  const save = () => {
    store.updateProfile({
      name: form.name,
      phone: form.phone,
      country: form.country,
      city: form.city,
    })
    if (!user) store.updateProfile({ email: form.email })
    setEditMode(false)
  }

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const inputClass =
    'bg-[#1A1A24] border border-[#2A2A38] focus:border-[#E50914] rounded-xl px-3 py-2 text-white text-sm w-full outline-none transition-colors'

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-6 h-6 text-[var(--color-brand-red)]" />
            {t.profile.pageTitle}
          </h1>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-6">
        <div className="bg-[#111118] border border-[#2A2A38] rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Left column — avatar */}
            <div className="w-32 shrink-0 flex flex-col items-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-[#2A2A38] bg-[var(--color-brand-elevated)] flex items-center justify-center">
                  {avatarSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarSrc} alt="" className="w-full h-full object-cover" width={96} height={96} />
                  ) : (
                    <User className="w-10 h-10 text-[var(--color-brand-text-secondary)]" />
                  )}
                </div>
                {editMode && (
                  <button
                    type="button"
                    onClick={() => setAvatarModalOpen(true)}
                    className="absolute bottom-0 end-0 w-7 h-7 rounded-full bg-[#E50914] flex items-center justify-center cursor-pointer hover:bg-[var(--color-brand-red-hover)] transition-colors"
                    aria-label={t.profile.changeAvatar}
                  >
                    <Pencil className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </div>
              {!editMode && (
                <button
                  type="button"
                  onClick={enterEditMode}
                  className="text-sm text-[#A0A0B8] hover:text-white border border-[#2A2A38] rounded-lg px-3 py-1.5 mt-3 w-full text-center transition-colors"
                >
                  {t.profile.editProfile}
                </button>
              )}
            </div>

            {/* Right column — details */}
            <div className="flex-1 min-w-0">
              {editMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A72] block mb-1">{t.profile.labelName}</label>
                    <input
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      className={inputClass}
                      placeholder={t.profile.placeholderName}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A72] block mb-1">
                      {user ? t.profile.labelEmailAccount : t.profile.labelEmail}
                    </label>
                    <input
                      value={form.email}
                      onChange={(e) => { if (!user) updateField('email', e.target.value) }}
                      readOnly={!!user}
                      className={`${inputClass} ${user ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A72] block mb-1">{t.profile.labelPhone}</label>
                    <input
                      value={form.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className={inputClass}
                      placeholder={t.profile.placeholderPhone}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A72] block mb-1">{t.profile.labelCountry}</label>
                    <input
                      value={form.country}
                      onChange={(e) => updateField('country', e.target.value)}
                      className={inputClass}
                      placeholder={t.profile.placeholderCountry}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A72] block mb-1">{t.profile.labelCity}</label>
                    <input
                      value={form.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      className={inputClass}
                      placeholder={t.profile.placeholderCity}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <FieldRow label={t.profile.labelName} value={displayName} />
                  <FieldRow label={t.profile.labelEmail} value={displayEmail} />
                  <FieldRow label={t.profile.labelPhone} value={store.profile.phone || ''} />
                  <FieldRow label={t.profile.labelCountry} value={store.profile.country || ''} />
                  <FieldRow label={t.profile.labelCity} value={store.profile.city || ''} />
                </>
              )}
            </div>
          </div>

          {editMode && (
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#2A2A38]">
              <button
                type="button"
                onClick={discard}
                className="px-4 py-2 rounded-xl border border-[#2A2A38] text-sm text-[#A0A0B8] hover:text-white hover:bg-[var(--color-brand-elevated)] transition-colors"
              >
                {t.profile.discard}
              </button>
              <button
                type="button"
                onClick={save}
                className="px-4 py-2 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
              >
                {t.profile.saveChanges}
              </button>
            </div>
          )}
        </div>

        {/* Section 2 — Budget Overview */}
        <div className="bg-[#111118] border border-[#2A2A38] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
              {t.profile.budgetTitle}
            </h2>
            <Link href="/#budget" className="text-xs text-[var(--color-brand-red)] hover:underline">
              {t.profile.budgetEditLink}
            </Link>
          </div>
          <div className="space-y-3">
            {budgetCategories.map((b) => {
              const spent = stats.categorySpending[b.category] || 0
              const cap = stats.categoryBudgetCaps?.[b.category] ?? b.budgetedAmount
              const pct = cap > 0 ? Math.min((spent / cap) * 100, 100) : 0
              return (
                <div key={b.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white">{b.category}</span>
                    <span className="text-xs text-[var(--color-brand-text-muted)] font-mono-numbers">
                      {formatCurrency(spent, stats.baseCurrency, false)} / {formatCurrency(cap, stats.baseCurrency, false)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--color-brand-border)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-brand-red)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Section 3 — Setup Progress */}
        <div className="bg-[#111118] border border-[#2A2A38] rounded-2xl p-6">
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-1">
            {t.profile.setupTitle}
          </h2>
          <p className="text-xs text-[var(--color-brand-text-muted)] mb-4">{setupMessage}</p>
          <div className="h-2 bg-[var(--color-brand-border)] rounded-full overflow-hidden mb-4">
            <div
              className="h-full rounded-full bg-[var(--color-brand-green)] transition-all"
              style={{ width: `${(completedCount / 5) * 100}%` }}
            />
          </div>
          <ul className="space-y-2">
            {setupSteps.map((step) => (
              <li key={step.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {step.done ? (
                    <Check className="w-4 h-4 text-[var(--color-brand-green)]" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-[#2A2A38]" />
                  )}
                  <span className={step.done ? 'text-sm text-white' : 'text-sm text-[var(--color-brand-text-muted)]'}>
                    {step.label}
                  </span>
                </div>
                {!step.done && (
                  <Link href={step.href} className="text-xs text-[var(--color-brand-red)] hover:underline flex items-center gap-0.5">
                    {t.profile.doIt} <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Section 4 — Account */}
        {user && (
          <div className="bg-[#111118] border border-[#2A2A38] rounded-2xl p-6">
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-4">
              {t.profile.accountTitle}
            </h2>
            <div className="space-y-3">
              <FieldRow label={t.profile.accountEmail} value={user.email || ''} />
              <FieldRow label={t.profile.accountMemberSince} value={store.profile.createdAt ? new Date(store.profile.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' }) : ''} />
            </div>
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-[#2A2A38]">
              <button
                type="button"
                onClick={handlePasswordReset}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#2A2A38] text-sm text-[#A0A0B8] hover:text-white hover:bg-[var(--color-brand-elevated)] transition-colors"
              >
                <Lock className="w-4 h-4" />
                {resetSent ? t.profile.resetLinkSent : t.profile.changePassword}
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E50914]/30 text-sm text-[#E50914] hover:bg-[#E50914]/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {t.common.signOut}
              </button>
            </div>
          </div>
        )}
      </div>

      <AvatarPickerModal
        open={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        store={store}
      />
    </div>
  )
}
