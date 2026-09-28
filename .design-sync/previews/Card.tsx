import { Card, Badge } from 'buddget'

const Row = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px' }}>
    <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
    <span className="font-mono-numbers" style={{ fontSize: 14, color: 'var(--color-brand-text-muted)' }}>{value}</span>
  </div>
)

/** The default surface at the design system's standard 18px padding. */
export const Default = () => (
  <div style={{ width: 360 }}>
    <Card>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-brand-text-muted)' }}>
        Spent this month
      </p>
      <p className="font-mono-numbers" style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>
        4,820.00 <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-brand-text-muted)' }}>SAR</span>
      </p>
    </Card>
  </div>
)

/** The four surface variants side by side. */
export const Variants = () => (
  <div style={{ width: 360, display: 'grid', gap: 10 }}>
    <Card padding="md"><b style={{ fontSize: 14 }}>default</b> — card fill on the page</Card>
    <Card padding="md" variant="elevated"><b style={{ fontSize: 14 }}>elevated</b> — a card on a card</Card>
    <Card padding="md" variant="brand"><b style={{ fontSize: 14 }}>brand</b> — promoted or selected</Card>
    <Card padding="md" variant="plain"><b style={{ fontSize: 14 }}>plain</b> — grouping with no box</Card>
  </div>
)

/**
 * Polymorphic: the surface on a `<ul>` with dividers. This is the settings and
 * notifications pattern — a Card hardcoded to `<div>` would make the markup
 * invalid here and drop the divider styling.
 */
export const AsListWithDividers = () => (
  <div style={{ width: 360 }}>
    <Card render={<ul />} padding="none" divide>
      <li><Row label="Base currency" value="SAR" /></li>
      <li><Row label="Month starts on" value="1" /></li>
      <li><Row label="Secondary currency" value="USD" /></li>
    </Card>
  </div>
)

/** Elevation scale — cards are flat by default; raise deliberately. */
export const Elevation = () => (
  <div style={{ width: 360, display: 'grid', gap: 14, padding: 4 }}>
    <Card padding="md" elevation="sm">shadow-sm — resting</Card>
    <Card padding="md" elevation="md">shadow-md — raised</Card>
    <Card padding="md" elevation="lg">shadow-lg — modal</Card>
  </div>
)

/** The full-bleed `list` variant: the ledger's day-group surface. */
export const ListSurface = () => (
  <div style={{ width: 360 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 18px 8px' }}>
      <span style={{ fontSize: 15, fontWeight: 700 }}>Today</span>
      <span className="font-mono-numbers" style={{ fontSize: 11, color: 'var(--color-brand-text-muted)' }}>−79.50 SAR</span>
    </div>
    <Card variant="list" padding="none" divide>
      <Row label="Half Million Coffee" value="−48.00" />
      <Row label="Uber" value="−31.50" />
    </Card>
  </div>
)

/** Interactive: the whole card is the tap target. Renders as a real button. */
export const Interactive = () => (
  <div style={{ width: 360, display: 'grid', gap: 10 }}>
    <Card render={<button type="button" />} interactive padding="md">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>SMS tracking</span>
        <Badge variant="positive" size="xs">On</Badge>
      </div>
    </Card>
    <Card render={<button type="button" />} interactive padding="md">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Payment methods</span>
        <Badge variant="muted" size="xs">4</Badge>
      </div>
    </Card>
  </div>
)
