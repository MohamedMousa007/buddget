import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms for using the Buddget personal finance app.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] text-[var(--color-brand-text-primary)]">
      <div className="max-w-2xl mx-auto px-4 py-10 lg:py-14 space-y-8">
        <div>
          <Link
            href="/"
            className="text-sm text-[var(--color-brand-red)] hover:text-[var(--color-brand-red-hover)] mb-4 inline-block"
          >
            ← Back to Buddget
          </Link>
          <h1 className="text-3xl font-bold font-heading tracking-tight">Terms of Service</h1>
          <p className="text-sm text-[var(--color-brand-text-muted)] mt-2">Last updated: March 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-brand-text-secondary)]">Service “as is”</h2>
          <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">
            Buddget is provided on an “as is” and “as available” basis. We strive for reliability but do not
            guarantee uninterrupted or error-free operation. Use of the app is at your own risk.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-brand-text-secondary)]">Not financial advice</h2>
          <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">
            Nothing in Buddget—including AI-generated suggestions—constitutes financial, tax, or legal advice.
            Consult a qualified professional for decisions affecting your finances.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-brand-text-secondary)]">Your data & responsibility</h2>
          <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">
            You are responsible for the accuracy of information you enter and for maintaining the security of
            your account credentials and devices. Do not use the service for unlawful purposes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-brand-text-secondary)]">Account termination</h2>
          <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">
            We may suspend or terminate access if these terms are violated or if required for legal or security
            reasons. You may stop using Buddget at any time. Provisions that reasonably should survive
            termination will remain in effect.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-brand-text-secondary)]">Contact</h2>
          <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">
            <a href="mailto:hello@buddget.online" className="text-[var(--color-brand-red)] hover:underline">
              hello@buddget.online
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
