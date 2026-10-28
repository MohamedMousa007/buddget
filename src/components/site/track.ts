type SiteEvent = 'view' | 'cta_click' | 'lead_submit'

function externalReferrerHost(): string {
  try {
    const host = new URL(document.referrer).hostname
    return host && host !== location.hostname ? host : ''
  } catch {
    return ''
  }
}

/** Fire-and-forget counter. Honours Do Not Track and Global Privacy Control. */
export function track(event: SiteEvent, path: string = location.pathname): void {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl) return
  const body = JSON.stringify({ path: path === '/' ? `/${document.documentElement.lang}` : path.replace(/\/$/, ''), event, ref: event === 'view' ? externalReferrerHost() : '' })
  const ok = nav.sendBeacon?.('/api/site/event', new Blob([body], { type: 'application/json' }))
  if (!ok) void fetch('/api/site/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
}
