import { SegmentedControl } from 'buddget'

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 360 }}>{children}</div>
)

/** The Flow tab's direction filter — the control this was built for. */
export const FlowDirection = () => (
  <Frame>
    <SegmentedControl
      ariaLabel="Filter by direction"
      value="all"
      onChange={() => {}}
      options={[
        { value: 'all', label: 'All' },
        { value: 'in', label: 'In' },
        { value: 'out', label: 'Out' },
      ]}
    />
  </Frame>
)

/** With per-segment counts — useful when a filter may return nothing. */
export const WithCounts = () => (
  <Frame>
    <SegmentedControl
      ariaLabel="Filter by direction"
      value="out"
      onChange={() => {}}
      options={[
        { value: 'all', label: 'All', count: 42 },
        { value: 'in', label: 'In', count: 2 },
        { value: 'out', label: 'Out', count: 40 },
      ]}
    />
  </Frame>
)

/** Two options — the savings/investment switch. */
export const TwoUp = () => (
  <Frame>
    <SegmentedControl
      ariaLabel="Account type"
      value="savings"
      onChange={() => {}}
      options={[
        { value: 'savings', label: 'Savings' },
        { value: 'investment', label: 'Investment' },
      ]}
    />
  </Frame>
)

/** Content-width rather than full-width, for a toolbar. */
export const Inline = () => (
  <Frame>
    <SegmentedControl
      ariaLabel="Period"
      value="month"
      fill={false}
      onChange={() => {}}
      options={[
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
        { value: 'year', label: 'Year' },
      ]}
    />
  </Frame>
)
