import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { IosSmsSetupClient } from '@/components/setup/IosSmsSetupClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'iOS SMS auto-tracking — Buddget',
  description: 'Build the Buddget Shortcut so bank SMS messages turn into expenses automatically.',
}

async function loadToken(userId: string): Promise<string | null> {
  const service = createServiceRoleClient()

  const { data: existing } = await service
    .from('sms_ingest_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.token) return existing.token

  const { data: created } = await service
    .from('sms_ingest_tokens')
    .insert({ user_id: userId })
    .select('token')
    .maybeSingle()

  return created?.token ?? null
}

export default async function IosSmsSetupPage() {
  const supabase = await createClient().catch(() => null)
  if (!supabase) {
    return (
      <main className="mx-auto max-w-3xl p-6 text-[var(--color-brand-text-primary)]">
        <h1 className="text-2xl font-semibold">SMS auto-tracking</h1>
        <p className="mt-2 text-sm text-[var(--color-brand-text-muted)]">
          Supabase isn’t configured on this build, so per-user setup tokens aren’t available here.
        </p>
      </main>
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/?next=/setup/ios-sms')
  }

  const token = await loadToken(user.id)
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || 'https://buddget.app'

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-[var(--color-brand-text-primary)]">
      <h1 className="text-2xl font-semibold">iOS SMS auto-tracking</h1>
      <p className="mt-2 text-sm text-[var(--color-brand-text-secondary)]">
        Build a one-time iOS Shortcut so every bank SMS turns into a Buddget expense
        automatically. Built for Egypt first — works across UAE and the GCC.
      </p>

      <Suspense fallback={null}>
        <IosSmsSetupClient
          token={token}
          parseEndpoint={`${origin}/api/sms/parse`}
          ingestEndpoint={`${origin}/api/sms/ingest`}
        />
      </Suspense>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Recommended trigger keywords</h2>
        <p className="text-sm text-[var(--color-brand-text-secondary)]">
          Configure your iOS Shortcuts automation to run when a new SMS contains any of
          these (Egypt-first, then UAE / GCC):
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            'EGP',
            'جنيه',
            'تم خصم',
            'تم سحب',
            'تم دفع',
            'عملية شراء',
            'debited',
            'spent at',
            'transaction of',
            'AED',
            'SAR',
            'QAR',
            'KWD',
            'OMR',
            'BHD',
          ].map((keyword) => (
            <li
              key={keyword}
              className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 px-3 py-2 text-sm font-mono"
            >
              {keyword}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Step-by-step Shortcut build</h2>
        <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm text-[var(--color-brand-text-secondary)]">
          <li>Open Shortcuts → Automation → Personal Automation → <em>Message</em>.</li>
          <li>
            In <em>Message Contains</em>, paste each keyword above on its own line. Toggle
            <strong> Run Without Asking</strong> on.
          </li>
          <li>Add action <em>Get Contents of URL</em>. Method = POST.</li>
          <li>
            URL = <code>{origin}/api/sms/parse</code>.
          </li>
          <li>
            Headers: <code>Authorization: Bearer YOUR_TOKEN</code> and
            <code>Content-Type: application/json</code>.
          </li>
          <li>
            Body (JSON):
            <pre className="mt-1 overflow-x-auto rounded-lg bg-[var(--color-brand-elevated)]/50 p-3 text-xs">
{`{
  "message": Shortcut "Message Body",
  "sender": Shortcut "Sender",
  "source": "sms"
}`}
            </pre>
          </li>
          <li>
            Add <em>Show Notification</em> → “Buddget logged your expense.” for instant
            feedback.
          </li>
          <li>Tap Done. Send yourself a test SMS — Buddget will pop a confirm push.</li>
        </ol>

        <p className="mt-4 text-xs text-[var(--color-brand-text-muted)]">
          We can’t generate a binary <code>.shortcut</code> file from the web — see
          <code> public/buddget-sms-tracker.shortcut.md </code>
          for the build-it-yourself reference.
        </p>
      </section>
    </main>
  )
}
