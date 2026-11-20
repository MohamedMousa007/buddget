import type { PreviewModel } from '@/lib/buddgy/tools/proposal'
import { EffectLine, Forward } from './parts'

/** Change: each changed value as before → after, the old one struck through, then the amber effect line. */
export function ChangeBody({ preview }: { preview: PreviewModel }) {
  return (
    <>
      <div className="flex flex-col">
        {preview.rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="flex min-h-12 items-center gap-2.5 border-b border-[var(--color-brand-border)]">
            <span dir="auto" className="min-w-0 flex-1 truncate">{r.label}</span>
            {r.before !== undefined ? (
              <>
                <s dir="auto" className="font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-muted)]">{r.before}</s>
                <Forward />
              </>
            ) : null}
            <span dir="auto" className="font-mono-numbers text-sm font-semibold">{r.value}</span>
          </div>
        ))}
      </div>
      {preview.effect ? <EffectLine>{preview.effect}</EffectLine> : null}
    </>
  )
}
