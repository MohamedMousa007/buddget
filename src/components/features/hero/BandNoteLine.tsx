import { Fragment, type ReactNode } from 'react'

const BOLD = 'font-mono-numbers font-semibold text-[var(--flow-band-fg)]'

/**
 * The light-touch band's one note line (mockup `noteLine`): short facts side by side with a 12px gap, wrapping on a
 * narrow screen. Empty parts are skipped.
 */
export function BandNoteLine({ parts }: { parts: ReactNode[] }) {
  const shown = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== '')
  if (!shown.length) return null
  return (
    <span dir="auto" className="flex flex-wrap gap-x-3 gap-y-1">
      {shown.map((p, i) => <span key={i}>{p}</span>)}
    </span>
  )
}

/**
 * A copy string with the given values bolded in place (mockup `B(...)`): `boldIn('Next 3,250 on Nov 5', '3,250')`.
 * Works in any locale because the values are found where the copy put them; a value not found is left plain.
 */
export function boldIn(text: string, ...values: string[]): ReactNode {
  const wanted = values.filter(Boolean)
  if (!wanted.length) return text
  const out: ReactNode[] = []
  let rest = text
  let key = 0
  while (rest) {
    let at = -1
    let hit = ''
    for (const v of wanted) {
      const i = rest.indexOf(v)
      if (i >= 0 && (at < 0 || i < at)) { at = i; hit = v }
    }
    if (at < 0) { out.push(rest); break }
    if (at > 0) out.push(rest.slice(0, at))
    out.push(<b key={key++} className={BOLD}>{hit}</b>)
    rest = rest.slice(at + hit.length)
  }
  return <Fragment>{out}</Fragment>
}
