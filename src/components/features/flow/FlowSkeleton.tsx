const PULSE = 'animate-pulse bg-[var(--color-brand-sunken)] motion-reduce:animate-none'

function Row() {
  return (
    <div className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
      <span className={`size-10 shrink-0 rounded-[11px] ${PULSE}`} />
      <span className="flex-1 space-y-2">
        <span className={`block h-3 w-[58%] rounded-full ${PULSE}`} />
        <span className={`block h-2.5 w-1/3 rounded-full ${PULSE}`} />
      </span>
      <span className={`h-3 w-12 rounded-full ${PULSE}`} />
    </div>
  )
}

/** Flow while the data loads: the hero's footprint, a month header and four rows, so nothing jumps when it lands. */
export function FlowSkeleton() {
  return (
    <div aria-hidden>
      <div className="mx-4 mt-4 h-[150px] animate-pulse rounded-3xl bg-[var(--color-brand-elevated)] motion-reduce:animate-none" />
      <div className={`mx-5 mb-2 mt-6 h-3 w-24 rounded-full ${PULSE}`} />
      <div className="mx-4 divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
        <Row />
        <Row />
        <Row />
        <Row />
      </div>
    </div>
  )
}
