'use client'

import { useRef } from 'react'
import { escapeHtml } from '@/lib/email/variables'
import { cn } from '@/lib/utils'

/** Syntax colouring for the HTML editor. Runs on escaped text, so the markup it adds can't be confused with the source. */
export function highlightHtml(src: string): string {
  return escapeHtml(src)
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<i class="c">$1</i>')
    .replace(/(\{\{\s*[a-z_]+\s*\}\})/g, '<i class="v">$1</i>')
    .replace(/(&lt;\/?)([a-zA-Z0-9]+)/g, '$1<i class="t">$2</i>')
    .replace(/([a-z-]+)=(&quot;[^&]*?&quot;)/g, '<i class="a">$1</i>=<i class="s">$2</i>')
}

const METRICS = 'font-mono text-[12px] leading-[18px] p-3 whitespace-pre'

/** A plain textarea with a coloured copy of its text behind it. */
export function CodeEditor({ value, onChange, label, className }: { value: string; onChange: (v: string) => void; label: string; className?: string }) {
  const pre = useRef<HTMLPreElement>(null)
  return (
    <div className={cn('relative h-[420px] overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]', className)}>
      <pre
        ref={pre}
        aria-hidden
        dir="ltr"
        className={cn(METRICS, 'pointer-events-none absolute inset-0 m-0 overflow-hidden text-[var(--color-brand-text-primary)]',
          '[&_i]:not-italic [&_i.t]:text-[var(--color-brand-primary-ink)] [&_i.a]:text-[var(--color-brand-amber)] [&_i.s]:text-[var(--color-brand-green)] [&_i.c]:text-[var(--color-brand-text-muted)] [&_i.v]:font-semibold [&_i.v]:text-[var(--color-brand-red)]')}
        dangerouslySetInnerHTML={{ __html: highlightHtml(value) + '\n' }}
      />
      <textarea
        aria-label={label}
        dir="ltr"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (!pre.current) return
          pre.current.scrollTop = e.currentTarget.scrollTop
          pre.current.scrollLeft = e.currentTarget.scrollLeft
        }}
        className={cn(METRICS, 'absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent text-transparent caret-[var(--color-brand-text-primary)] outline-none selection:bg-[var(--color-brand-primary-soft)]')}
      />
    </div>
  )
}
