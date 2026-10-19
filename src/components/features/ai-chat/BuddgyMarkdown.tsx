import { Fragment, useMemo } from 'react'
import { parseMarkdown, type Span } from '@/lib/buddgy/markdown'

function Inline({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) =>
        s.bold ? (
          <strong key={i} className="font-semibold text-[var(--color-brand-text-primary)]">{s.text}</strong>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </>
  )
}

/** Buddgy's replies: paragraphs, bullets, numbered steps and bold figures. Text only, never raw HTML. */
export function BuddgyMarkdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text])
  return (
    <div className="space-y-2 break-words">
      {blocks.map((b, i) => {
        if (b.type === 'p') {
          return (
            <p key={i} dir="auto">
              {b.lines.map((line, j) => (
                <Fragment key={j}>
                  {j > 0 ? <br /> : null}
                  <Inline spans={line} />
                </Fragment>
              ))}
            </p>
          )
        }
        const Tag = b.type === 'ul' ? 'ul' : 'ol'
        return (
          <Tag key={i} dir="auto" className={`ms-4 space-y-1 ${b.type === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-[var(--color-brand-text-muted)]`}>
            {b.items.map((item, j) => (
              <li key={j}>
                <Inline spans={item} />
              </li>
            ))}
          </Tag>
        )
      })}
    </div>
  )
}
