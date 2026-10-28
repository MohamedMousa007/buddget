import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { JsonLd } from '@/components/site/JsonLd'
import { SiteShell } from '@/components/site/SiteShell'
import { renderRoute } from '@/components/site/renderRoute'
import { listRoutes } from '@/lib/site/routes'
import { buildMetadata } from '@/lib/site/seo'

const LOCALE = 'ar'

type Params = { slug?: string[] }

export const dynamicParams = false

export function generateStaticParams(): Params[] {
  return listRoutes(LOCALE).map((r) => ({ slug: r.slug ? r.slug.split('/') : [] }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  return buildMetadata(LOCALE, (slug ?? []).join('/'))
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const path = (slug ?? []).join('/')
  const page = renderRoute(LOCALE, path)
  if (!page) notFound()
  return (
    <SiteShell locale={LOCALE} slug={path}>
      <JsonLd data={page.ld} />
      {page.node}
    </SiteShell>
  )
}
