import { BOTTOM_NAV_TAB_PATHS } from '@/lib/navigation/bottomNavConfig'

const underPath = (pathname: string, base: string): boolean =>
  pathname === base || pathname.startsWith(`${base}/`)

/**
 * Whether `tab` (a nav href) is the current destination. Tabs with an alias set in
 * BOTTOM_NAV_TAB_PATHS light for every alias and their sub-routes; other
 * destinations match their own path and sub-routes.
 */
export function isTabActive(pathname: string, tab: string): boolean {
  const aliases = BOTTOM_NAV_TAB_PATHS[tab]
  if (!aliases) return underPath(pathname, tab)
  for (const p of aliases) {
    if (p === '/' ? pathname === '/' : underPath(pathname, p)) return true
  }
  return false
}

/**
 * The single href to highlight in a nav that lists more destinations than the tab
 * map (Paydays is both a Flow alias and its own sidebar row): a destination whose own
 * path matches wins over another tab's alias.
 */
export function activeNavHref(pathname: string, hrefs: readonly string[]): string | null {
  const own = hrefs.find((h) => h !== '/' && underPath(pathname, h) && !BOTTOM_NAV_TAB_PATHS[h])
  if (own) return own
  return hrefs.find((h) => isTabActive(pathname, h)) ?? null
}
