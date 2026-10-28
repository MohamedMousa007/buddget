import { SiteShell } from '@/components/site/SiteShell'
import { NotFoundView } from '@/components/site/pages'

export default function NotFound() {
  return (
    <SiteShell locale="ar" slug="404">
      <NotFoundView locale="ar" />
    </SiteShell>
  )
}
