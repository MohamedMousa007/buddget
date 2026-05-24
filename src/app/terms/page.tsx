import { redirect } from 'next/navigation'

/** Canonical URL moved to /legal/terms — redirect to preserve any existing backlinks. */
export default function TermsRedirectPage() {
  redirect('/legal/terms')
}
