import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Buddget collects, stores, and protects your personal finance data.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10 lg:py-14 space-y-8">
        <div>
          <Link
            href="/"
            className="text-sm text-[var(--color-brand-red)] hover:text-[var(--color-brand-red-hover)] mb-4 inline-block"
          >
            ← Back to Buddget
          </Link>
          <h1 className="text-3xl font-bold font-heading tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-[var(--color-brand-text-muted)] mt-2">Last updated: March 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-brand-text-secondary)]">Data we collect</h2>
          <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">
            Buddget stores the budget and finance information you enter in the app—such as expenses, income,
            debts, savings, and preferences—to provide tracking, reports, and optional AI-assisted features.
            If you sign in, your account email is processed by our authentication provider.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-brand-text-secondary)]">Storage & security</h2>
          <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">
            Signed-in data is synced using Supabase with encryption in transit (HTTPS). Industry-standard
            practices apply on Supabase infrastructure; you are responsible for keeping your password and
            device secure.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-brand-text-secondary)]">We do not sell your data</h2>
          <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">
            Buddget does not sell your personal financial data to third parties. Analytics, if enabled, are
            used to improve the service and are described in our infrastructure configuration.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-brand-text-secondary)]">Your rights & deletion</h2>
          <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">
            You may export or reset data from Settings where available. To request deletion of account data
            held with our providers, contact us using the email below and include the address associated with
            your account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-brand-text-secondary)]">Contact</h2>
          <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">
            Questions about this policy:{' '}
            <a href="mailto:hello@buddget.online" className="text-[var(--color-brand-red)] hover:underline">
              hello@buddget.online
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
