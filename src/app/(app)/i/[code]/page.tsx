import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { InviteLanding } from '@/components/features/invite/InviteLanding'
import { normalizeInviteCode } from '@/components/features/invite/inviteCode'

export const metadata: Metadata = { title: 'Your guest pass', robots: { index: false, follow: false } }

/** An invite link (web only; native opens the app from the link instead). A link that cannot be a code just opens the app. */
export default async function InviteLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeInviteCode((await params).code)
  if (!code) redirect('/')
  return <InviteLanding code={code} />
}
