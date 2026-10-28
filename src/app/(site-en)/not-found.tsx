import { SiteShell } from '@/components/site/SiteShell'
import { NotFoundView } from '@/components/site/pages'

export default function NotFound() {
  return (
    <SiteShell locale="en" slug="404">
      <NotFoundView locale="en" />
    </SiteShell>
  )
}
