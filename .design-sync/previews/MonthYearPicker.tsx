import { MonthYearPicker } from 'buddget'

/* Only the trigger renders statically: the month grid lives in a Popover driven by the
 * component's own `open` state, which no prop exposes, so the picked-month grid cannot appear in
 * a card. Two trigger skins — `heroLabel` for a page header, the default calendar-icon pill for
 * inline use — plus `compact` for the short month name. */

const Header = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: 440,
      background: 'var(--color-brand-card)',
      border: '1px solid var(--color-brand-border)',
      borderRadius: 16,
      padding: '14px 18px',
    }}
  >
    {children}
  </div>
)

const NavBtn = ({ dir }: { dir: 'prev' | 'next' }) => (
  <span
    style={{
      display: 'inline-flex',
      height: 34,
      width: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      border: '1px solid var(--color-brand-border)',
      background: 'var(--color-brand-elevated)',
      color: 'var(--color-brand-text-secondary)',
    }}
  >
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points={dir === 'prev' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
    </svg>
  </span>
)

/** `heroLabel` — the Expenses and Income page header: bold month, mono year, chevron, flanked by
 *  the month-step buttons. No calendar icon; the big month IS the affordance. */
export const PageHeader = () => (
  <Header>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <MonthYearPicker monthFilter="2026-09" onChange={() => {}} heroLabel />
      <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 6 }}>
        <NavBtn dir="prev" />
        <NavBtn dir="next" />
      </div>
    </div>
  </Header>
)

/** A month whose name is long, in a header that also carries a total — the trigger shrinks to its
 *  content and the year stays mono, so the two never collide. */
export const PageHeaderWithTotal = () => (
  <Header>
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <MonthYearPicker monthFilter="2026-02" onChange={() => {}} heroLabel />
      <div style={{ textAlign: 'end' }}>
        <p
          className="font-mono-numbers"
          style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-brand-text-primary)' }}
        >
          E£ 18,450.00
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--color-brand-text-muted)' }}>Spent</p>
      </div>
    </div>
  </Header>
)

/** Default trigger — calendar glyph + full month, for filter bars and secondary surfaces. */
export const InlineTrigger = () => (
  <Header>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--color-brand-text-muted)' }}>Period</span>
      <MonthYearPicker monthFilter="2026-09" onChange={() => {}} className="text-sm" />
    </div>
  </Header>
)

/** `compact` shortens the month to three letters — for the dense month stepper where the arrows
 *  sit hard against the label. */
export const CompactStepper = () => (
  <Header>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <NavBtn dir="prev" />
      <MonthYearPicker monthFilter="2026-11" onChange={() => {}} compact className="text-sm" />
      <NavBtn dir="next" />
    </div>
  </Header>
)
