import { StatTile, Badge } from 'buddget'

/** The three-up KPI row from the revamp kit — compact, under a hero. */
export const KpiRow = () => (
  <div style={{ width: 360, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
    <StatTile compact label="Income" value="18,900" tone="positive" />
    <StatTile compact label="Spent" value="11,240" />
    <StatTile compact label="Left" value="7,660" />
  </div>
)

/** Full tile with an icon chip and a delta badge. */
export const WithIconAndDelta = () => (
  <div style={{ width: 360 }}>
    <StatTile
      label="Spent this month"
      value="11,240"
      unit="SAR"
      sub="≈ $2,997 · 18 days left"
      icon={<span style={{ fontSize: 15, fontWeight: 700 }}>↑</span>}
      trailing={<Badge variant="positive" size="xs">8% under</Badge>}
    />
  </div>
)

/**
 * Tones. Note `default` for an outflow — money going out is plain text, not red.
 * Red is reserved for destructive and over-budget, so it keeps its meaning.
 */
export const Tones = () => (
  <div style={{ width: 360, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
    <StatTile label="Money in" value="18,900" unit="SAR" tone="positive" />
    <StatTile label="Money out" value="11,240" unit="SAR" tone="default" />
    <StatTile label="Over budget" value="1,180" unit="SAR" tone="negative" />
    <StatTile label="Net flow" value="7,660" unit="SAR" tone="brand" />
  </div>
)

/** Tappable — the whole tile becomes a button and drills into a report. */
export const Tappable = () => (
  <div style={{ width: 360, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
    <StatTile label="Savings" value="42,600" unit="SAR" sub="3 pockets" onClick={() => {}} />
    <StatTile label="Debts" value="9,150" unit="SAR" sub="2 open" onClick={() => {}} />
  </div>
)
