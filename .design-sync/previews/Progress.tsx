import { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue } from 'buddget'

const Card = ({ children, width = 380 }: { children: React.ReactNode; width?: number }) => (
  <div
    style={{
      width,
      padding: 20,
      borderRadius: 18,
      background: 'var(--color-brand-card)',
      border: '1px solid var(--color-brand-border)',
      display: 'grid',
      gap: 20,
    }}
  >
    {children}
  </div>
)

/** The full compound composition: label and value share the top line, the track sits
 * under both. `ProgressValue` formats the percentage itself. */
export const BudgetUsage = () => (
  <Card>
    <Progress value={78}>
      <ProgressLabel className="text-[var(--color-brand-text-primary)]">Food budget</ProgressLabel>
      <ProgressValue className="font-mono-numbers" />
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </Progress>
  </Card>
)

/** Bare `Progress` — no children, so it renders its own track and indicator. This is the
 * one-liner form for a row that already carries its own labels. */
export const Default = () => (
  <Card width={320}>
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--color-brand-text-secondary)' }}>Salary received</span>
        <span className="font-mono-numbers" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-brand-text-primary)' }}>
          9,250 / 18,500
        </span>
      </div>
      <Progress value={50} />
    </div>
  </Card>
)

/** Semantic fills. The indicator takes the brand token for the state it reports —
 * green on track, amber tight, red over — which is how every pace surface reads. */
export const PaceThresholds = () => (
  <Card>
    {[
      { name: 'Emergency fund', value: 92, note: '46,000 of 50,000 SAR', color: 'var(--color-brand-green)' },
      { name: 'Transport', value: 71, note: '355 of 500 SAR · 3 days left', color: 'var(--color-brand-amber)' },
      { name: 'Eating out', value: 100, note: '640 of 500 SAR · 140 over', color: 'var(--color-brand-red)' },
    ].map((r) => (
      <Progress key={r.name} value={r.value}>
        <ProgressLabel className="text-[var(--color-brand-text-primary)]">{r.name}</ProgressLabel>
        <ProgressValue className="font-mono-numbers" />
        <ProgressTrack>
          <ProgressIndicator style={{ background: r.color }} />
        </ProgressTrack>
        <span style={{ fontSize: 12, color: 'var(--color-brand-text-muted)', width: '100%' }}>{r.note}</span>
      </Progress>
    ))}
  </Card>
)

/** The `max` prop: pass the budget as `max` and the spend as `value` instead of
 * pre-computing a percentage. The track scales itself, but `ProgressValue` prints the raw
 * value — so once `max` is not 100 the readout has to be formatted through its
 * `(formattedValue, value)` children function. */
export const CustomMax = () => (
  <Card width={320}>
    <Progress value={1400} max={2000}>
      <ProgressLabel className="text-[var(--color-brand-text-primary)]">Groceries</ProgressLabel>
      <ProgressValue className="font-mono-numbers">
        {(_formatted, value) => `${Math.round(((value ?? 0) / 2000) * 100)}%`}
      </ProgressValue>
      <ProgressTrack>
        <ProgressIndicator style={{ background: 'var(--color-brand-amber)' }} />
      </ProgressTrack>
      <span style={{ fontSize: 12, color: 'var(--color-brand-text-muted)', width: '100%' }}>
        1,400 of 2,000 SAR · 6 days left in September
      </span>
    </Progress>
  </Card>
)
