import { SOCIAL_LINKS } from '@/lib/site/config'

/** Renders only the channels that have a URL in `SOCIAL_LINKS`; nothing at all when none are set. */
export function SocialLinks({ label }: { label: string }) {
  const links = SOCIAL_LINKS.filter((s) => s.url)
  if (links.length === 0) return null
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2.5">
      {links.map((s) => (
        <li key={s.id}>
          <a
            href={s.url}
            rel="me noopener"
            aria-label={s.label}
            className="grid size-11 place-items-center rounded-full border border-brand-border-strong text-sm font-semibold text-brand-text-primary hover:border-brand-primary hover:text-brand-primary-ink"
          >
            {s.short}
          </a>
        </li>
      ))}
    </ul>
  )
}

export function hasSocialLinks(): boolean {
  return SOCIAL_LINKS.some((s) => s.url)
}
