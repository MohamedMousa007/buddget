import { SOCIAL_LINKS } from '@/lib/site/config'

const base = 'grid size-11 place-items-center rounded-full border text-sm font-semibold'

/**
 * Every channel shows as a button. Until its URL is set in `SOCIAL_LINKS` it is an inert, dashed placeholder;
 * filling the URL turns it into a real link with no other change.
 */
export function SocialLinks({ label }: { label: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2.5">
      {SOCIAL_LINKS.map((s) => (
        <li key={s.id}>
          {s.url ? (
            <a href={s.url} rel="me noopener" aria-label={s.label} className={`${base} border-brand-border-strong text-brand-text-primary hover:border-brand-primary hover:text-brand-primary-ink`}>
              {s.short}
            </a>
          ) : (
            <span role="img" aria-label={`${s.label} (soon)`} title={`${s.label} (soon)`} className={`${base} border-dashed border-brand-border-strong text-brand-text-secondary`}>
              {s.short}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
