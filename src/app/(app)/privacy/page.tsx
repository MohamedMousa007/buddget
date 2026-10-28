import { redirect } from 'next/navigation'

/** Canonical URL moved to /legal/privacy — redirect to preserve any existing backlinks. */
export default function PrivacyRedirectPage() {
  redirect('/legal/privacy')
}
