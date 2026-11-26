import { redirect } from 'next/navigation'

/** The Budget page lives at /budget-setup; /budget is the address people type. */
export default function BudgetRedirectPage() {
  redirect('/budget-setup')
}
