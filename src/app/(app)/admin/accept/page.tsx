import type { Metadata } from 'next'
import { AcceptInvite } from '@/components/features/admin/auth/AcceptInvite'

export const metadata: Metadata = {
  title: 'Admin invite',
  robots: { index: false, follow: false },
}

export default function AcceptInvitePage() {
  return <AcceptInvite />
}
