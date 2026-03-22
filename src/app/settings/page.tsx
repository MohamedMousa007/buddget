'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { formatCurrency, formatRelativeTime } from '@/lib/utils/formatters'
import { calculateMonthlyIncome, effectiveCategoryBudget } from '@/lib/utils/calculations'
import { checkAIStatus } from '@/lib/ai/gemini'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import {
  LogOut,
  User,
  Globe,
  Target,
  DollarSign,
  CreditCard,
  Bot,
  Database,
  Palette,
  Pencil,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Shield,
  PiggyBank,
} from 'lucide-react'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import type { Currency, ExpenseCategory } from '@/lib/store/types'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { useRequireAuthAction } from '@/lib/hooks/useRequireAuthAction'

export default function SettingsPage() {
  const router = useRouter()
  const { user, signOut, openAuthModal } = useAuth()
  const supabaseConfigured = useMemo(
    () =>
      !!(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    []
  )
  const store = useFinanceStore()
  const { setActiveModal } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [aiStatus, setAiStatus] = useState<{ enabled: boolean; model: string }>({ enabled: false, model: '' })
  const [importBanner, setImportBanner] = useState<{ variant: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    checkAIStatus().then(setAiStatus)
  }, [])

  useEffect(() => {
    if (user?.email) {
      useFinanceStore.getState().updateProfile({ email: user.email })
    }
  }, [user?.email])

  useEffect(() => {
    if (!importBanner) return
    const t = setTimeout(() => setImportBanner(null), 6000)
    return () => clearTimeout(t)
  }, [importBanner])
  const [editingBudget, setEditingBudget] = useState<ExpenseCategory | null>(null)
  const [budgetInput, setBudgetInput] = useState('')

  const handleExport = () => {
    const data = store.exportData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `buddget-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return
      try {
        store.importData(text)
        setImportBanner({ variant: 'success', text: 'Data imported successfully.' })
      } catch (err) {
        setImportBanner({
          variant: 'error',
          text: err instanceof Error ? err.message : 'Import failed.',
        })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const monthlyIncome = calculateMonthlyIncome(
    store.incomeSources,
    store.settings.baseCurrency,
    store.exchangeRates
  )
  const budgetMode = store.settings.budgetEntryMode ?? 'amount'

  const handleBudgetSave = (category: ExpenseCategory) => {
    const raw = parseFloat(budgetInput)
    if (Number.isNaN(raw) || raw < 0) {
      setEditingBudget(null)
      setBudgetInput('')
      return
    }
    if (budgetMode === 'percent_of_income') {
      const pct = Math.min(100, Math.max(0, raw))
      const derived =
        monthlyIncome > 0 ? (pct / 100) * monthlyIncome : 0
      store.updateBudgetCategory(category, derived, pct)
    } else {
      store.updateBudgetCategory(category, raw, null)
    }
    setEditingBudget(null)
    setBudgetInput('')
  }

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-white">Settings</h1>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 space-y-6 max-w-3xl mx-auto">
        {importBanner ? (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm ${
              importBanner.variant === 'success'
                ? 'border-[var(--color-brand-green)]/40 bg-[var(--color-brand-green)]/10 text-[var(--color-brand-green)]'
                : 'border-[var(--color-brand-red)]/50 bg-red-950/30 text-[var(--color-brand-red)]'
            }`}
          >
            {importBanner.text}
          </div>
        ) : null}

        {!user && supabaseConfigured ? (
          <section className="glass-card rounded-2xl p-5 space-y-3 border border-[var(--color-brand-border)]/80">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--color-brand-red)]" />
              <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
                Account
              </h2>
            </div>
            <p className="text-sm text-[var(--color-brand-text-muted)]">
              You&apos;re using Buddget on this device with local data. Sign in to sync your budget securely to your
              account and use it on other devices.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openAuthModal('/settings')}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => openAuthModal('/settings')}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-[var(--color-brand-border)] text-sm text-white hover:bg-[var(--color-brand-elevated)] transition-colors"
              >
                Log in
              </button>
            </div>
          </section>
        ) : null}

        {/* Account (Supabase) */}
        {user ? (
          <section className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-[var(--color-brand-red)]" />
              <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
                Account
              </h2>
            </div>
            <p className="text-xs text-[var(--color-brand-text-muted)]">
              Signed in as <span className="text-white font-mono-numbers">{user.email}</span>. Your budget syncs to this
              account.
            </p>
            <button
              type="button"
              onClick={async () => {
                await signOut()
                router.replace('/')
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-brand-border)] text-sm text-white hover:bg-[var(--color-brand-elevated)] transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </section>
        ) : null}

        {/* Profile */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-5 h-5 text-[var(--color-brand-red)]" />
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">Profile</h2>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Name</Label>
              <Input
                value={store.profile.name}
                onChange={(e) => store.updateProfile({ name: e.target.value })}
                className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">
                Email {user ? '(from account)' : ''}
              </Label>
              <Input
                value={store.profile.email || ''}
                onChange={(e) => {
                  if (!user) store.updateProfile({ email: e.target.value })
                }}
                readOnly={!!user}
                className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white read-only:opacity-80"
                placeholder="your@email.com"
              />
            </div>
          </div>
        </section>

        {/* Currencies */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-[var(--color-brand-red)]" />
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">Currencies</h2>
          </div>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">Primary Currency</Label>
            <select
              value={store.settings.baseCurrency}
              onChange={(e) => store.updateSettings({ baseCurrency: e.target.value as Currency })}
              className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
            >
              {FIAT_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">All summaries and totals display in this currency</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-white">Show secondary currency</Label>
              <p className="text-[10px] text-[var(--color-brand-text-muted)]">Display equivalent in brackets beside primary amounts</p>
            </div>
            <Switch
              checked={store.settings.showSecondaryCurrency}
              onCheckedChange={(val) => store.updateSettings({ showSecondaryCurrency: val })}
            />
          </div>

          {store.settings.showSecondaryCurrency && (
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Secondary Currency</Label>
              <select
                value={store.settings.secondaryCurrency || ''}
                onChange={(e) => store.updateSettings({ secondaryCurrency: (e.target.value || null) as Currency | null })}
                className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
              >
                <option value="">None</option>
                {FIAT_CURRENCIES.filter((c) => c !== store.settings.baseCurrency).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          <Separator className="bg-[var(--color-brand-border)]" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--color-brand-text-secondary)]">Exchange Rates</p>
              <p className="text-xs text-[var(--color-brand-text-muted)] flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                {store.lastRatesFetch ? formatRelativeTime(store.lastRatesFetch) : 'Not fetched yet'}
              </p>
            </div>
            <div className="space-y-1.5">
              {Object.entries(store.exchangeRates).map(([key, rate]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-[var(--color-brand-text-secondary)]">{key.replace('_', ' → ')}</span>
                  <span className="font-mono-numbers text-white">{(rate as number).toFixed(4)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-brand-gold)]">Gold (24k/g)</span>
                <span className="font-mono-numbers text-[var(--color-brand-gold)]">
                  {formatCurrency(store.goldPricePerGram, store.settings.baseCurrency)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Budget Setup */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-[var(--color-brand-red)]" />
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">Budget Setup</h2>
          </div>
          <p className="text-[10px] text-[var(--color-brand-text-muted)]">
            All budget numbers are in <strong className="text-white">{store.settings.baseCurrency}</strong> (primary currency).
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => store.updateSettings({ budgetEntryMode: 'amount' })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                budgetMode === 'amount'
                  ? 'bg-[var(--color-brand-red)] text-white'
                  : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
              }`}
            >
              Fixed amounts
            </button>
            <button
              type="button"
              onClick={() => store.updateSettings({ budgetEntryMode: 'percent_of_income' })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                budgetMode === 'percent_of_income'
                  ? 'bg-[var(--color-brand-red)] text-white'
                  : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
              }`}
            >
              % of monthly income
            </button>
          </div>
          {budgetMode === 'percent_of_income' && (
            <p className="text-[10px] text-[var(--color-brand-text-muted)]">
              Recurring income total (→ {store.settings.baseCurrency}):{' '}
              <span className="font-mono-numbers text-white">{formatCurrency(monthlyIncome, store.settings.baseCurrency)}</span>
              /mo. Category % should add up to ~100 for a full allocation.
            </p>
          )}
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">Month starts on</Label>
            <select
              value={store.settings.monthStartDay}
              onChange={(e) => store.updateSettings({ monthStartDay: parseInt(e.target.value) })}
              className="mt-1 w-24 h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {store.budgetCategories.map((budget) => (
              <div key={budget.category} className="flex items-center justify-between py-2 border-b border-[var(--color-brand-border)] last:border-0">
                <span className="text-sm text-white">{budget.category}</span>
                {editingBudget === budget.category ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      className="w-28 h-8 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleBudgetSave(budget.category)
                        if (e.key === 'Escape') setEditingBudget(null)
                      }}
                    />
                    <span className="text-[10px] text-[var(--color-brand-text-muted)]">
                      {budgetMode === 'percent_of_income' ? '%' : store.settings.baseCurrency}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleBudgetSave(budget.category)}
                      className="text-xs text-[var(--color-brand-green)]"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBudget(budget.category)
                      if (budgetMode === 'percent_of_income') {
                        const eff = effectiveCategoryBudget(budget, store.settings, monthlyIncome)
                        const pct =
                          budget.percentOfIncome ??
                          (monthlyIncome > 0 ? (eff / monthlyIncome) * 100 : 0)
                        setBudgetInput(pct.toFixed(1))
                      } else {
                        setBudgetInput(budget.budgetedAmount.toString())
                      }
                    }}
                    className="flex flex-col items-end gap-0.5 text-sm font-mono-numbers text-[var(--color-brand-text-secondary)] hover:text-white transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {budgetMode === 'percent_of_income' ? (
                        <>
                          <span>{(budget.percentOfIncome ?? 0).toFixed(1)}%</span>
                          <span className="text-[10px] text-[var(--color-brand-text-muted)]">
                            ({formatCurrency(
                              effectiveCategoryBudget(budget, store.settings, monthlyIncome),
                              store.settings.baseCurrency,
                              false
                            )})
                          </span>
                        </>
                      ) : (
                        formatCurrency(budget.budgetedAmount, store.settings.baseCurrency, false)
                      )}
                      <Pencil className="w-3 h-3 opacity-50" />
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Income — full page */}
        <section className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-5 h-5 text-[var(--color-brand-red)]" />
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">Income</h2>
          </div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">
            Manage salary and other income on the dedicated Income page (add, edit, delete).
          </p>
          <Link
            href="/income"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
          >
            Open Income →
          </Link>
        </section>

        {/* Savings — full page (sidebar on desktop; linked here for mobile) */}
        <section className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <PiggyBank className="w-5 h-5 text-[var(--color-brand-red)]" />
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">Savings</h2>
          </div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">
            Holdings and savings buckets live on the Savings page.
          </p>
          <Link
            href="/savings"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
          >
            Open Savings →
          </Link>
        </section>

        {/* Payment Methods */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[var(--color-brand-red)]" />
              <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">Payment Methods</h2>
            </div>
            <button
              onClick={() =>
                requireAuth(
                  () => setActiveModal('addPaymentMethod'),
                  'Sign in or create an account to add payment methods.'
                )
              }
              className="text-xs text-[var(--color-brand-red)] hover:text-[var(--color-brand-red-hover)]"
            >
              + Add
            </button>
          </div>
          <div className="space-y-2">
            {store.paymentMethods.map((method) => (
              <div key={method.id} className="flex items-center justify-between py-2 border-b border-[var(--color-brand-border)] last:border-0 group">
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: method.color || '#fff' }}
                  />
                  <div>
                    <p className="text-sm text-white">{method.name}</p>
                    <p className="text-xs text-[var(--color-brand-text-muted)]">
                      {method.type.replace('_', ' ')} · {method.currency}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Delete this payment method? Existing expenses will keep its old ID.')) {
                      store.deletePaymentMethod(method.id)
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-900/30"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[var(--color-brand-red)]" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* AI Assistant */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-5 h-5 text-[var(--color-brand-red)]" />
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">AI Assistant</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-white">Enable AI in app</Label>
              <p className="text-xs text-[var(--color-brand-text-muted)]">Toggle client preference (server still needs API keys)</p>
            </div>
            <Switch
              checked={store.settings.enableAI}
              onCheckedChange={(val) => store.updateSettings({ enableAI: val })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Status</p>
              <p className="text-xs text-[var(--color-brand-text-muted)]">Google Gemini (Server-side)</p>
            </div>
            <div className="flex items-center gap-2">
              {aiStatus.enabled ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-brand-green)]" />
                  <span className="text-sm text-[var(--color-brand-green)] font-medium">Active</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-[var(--color-brand-text-muted)]" />
                  <span className="text-sm text-[var(--color-brand-text-muted)] font-medium">Not configured</span>
                </>
              )}
            </div>
          </div>

          {aiStatus.model && (
            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-brand-border)]">
              <span className="text-xs text-[var(--color-brand-text-muted)]">Model</span>
              <span className="text-xs font-mono-numbers text-[var(--color-brand-text-secondary)]">{aiStatus.model}</span>
            </div>
          )}

          <p className="text-xs text-[var(--color-brand-text-muted)]">
            AI configuration is managed by the admin. Tap the chat bubble (bottom-right) to use the AI assistant.
          </p>
          <p className="text-[11px] text-[var(--color-brand-text-muted)] border-t border-[var(--color-brand-border)] pt-3">
            Free Gemini keys have a separate limit from Google (~20 requests/min). Admin &quot;Throttle per device&quot; only adds an
            optional cap in this app — it does not remove Google&apos;s quota. If you hit quota errors, wait, send fewer messages,
            or upgrade the key in Google AI Studio.
          </p>
        </section>

        {/* Admin */}
        <section className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--color-brand-red)]" />
              <div>
                <p className="text-sm text-white">Admin Panel</p>
                <p className="text-xs text-[var(--color-brand-text-muted)]">Manage AI, server config & more</p>
              </div>
            </div>
            <Link
              href="/admin"
              className="px-4 py-2 rounded-lg border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
            >
              Open →
            </Link>
          </div>
        </section>

        {/* Data Management */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-5 h-5 text-[var(--color-brand-red)]" />
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">Data Management</h2>
          </div>

          <p className="text-xs text-[var(--color-brand-text-muted)] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 px-3 py-2.5">
            Data stays in this browser (local storage). Export a JSON backup from time to time — especially with years of
            transactions — so you can recover quickly if you clear site data or switch devices.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
            >
              <Download className="w-4 h-4" />
              Export All Data (JSON)
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import Data (JSON)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />

            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-900/50 text-sm text-[var(--color-brand-red)] hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Reset All Data
              </button>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/20 border border-red-900/50">
                <AlertTriangle className="w-5 h-5 text-[var(--color-brand-red)]" />
                <span className="text-sm text-[var(--color-brand-red)]">Are you sure?</span>
                <button
                  onClick={() => {
                    store.resetAllData()
                    setShowResetConfirm(false)
                  }}
                  className="px-3 py-1 rounded-lg bg-[var(--color-brand-red)] text-white text-xs font-medium"
                >
                  Yes, reset
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1 rounded-lg border border-[var(--color-brand-border)] text-xs text-[var(--color-brand-text-secondary)]"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </section>

        {/* App */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="w-5 h-5 text-[var(--color-brand-red)]" />
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">App</h2>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm text-white">Show cents in dashboard</Label>
            <Switch
              checked={store.settings.showCentsInDashboard}
              onCheckedChange={(val) => store.updateSettings({ showCentsInDashboard: val })}
            />
          </div>
        </section>

        <p className="text-center text-xs text-[var(--color-brand-text-muted)] pb-8">
          Buddget v1.0 — Your money, finally makes sense.
        </p>
      </div>
    </div>
  )
}
