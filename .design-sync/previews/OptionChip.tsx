import { OptionChip } from 'buddget'

const Surface = ({
  children,
  tone = 'card',
}: {
  children: React.ReactNode
  tone?: 'card' | 'page'
}) => (
  <div
    style={{
      width: 380,
      padding: 18,
      borderRadius: 18,
      background: tone === 'card' ? 'var(--color-brand-card)' : 'var(--color-brand-bg)',
      border: '1px solid var(--color-brand-border)',
    }}
  >
    {children}
  </div>
)

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>
)

/** Selected vs not. Selection changes the fill **and** the border, and is announced
 *  as `aria-pressed` — it is never carried by colour alone. */
export const Selection = () => (
  <Surface>
    <Row>
      <OptionChip selected>Monthly</OptionChip>
      <OptionChip>Biweekly</OptionChip>
      <OptionChip>Weekly</OptionChip>
    </Row>
  </Surface>
)

/** The two surfaces. Default is `elevated`, because most chips live inside a sheet and
 *  `ModalShell` panels are `--color-brand-card` — a card-filled chip there would be
 *  white on white. Use `surface="card"` only on the page background. */
export const Surfaces = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <Surface>
      <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--color-brand-text-muted)' }}>
        inside a sheet — default (elevated)
      </div>
      <Row>
        <OptionChip>Cash</OptionChip>
        <OptionChip selected>Card</OptionChip>
      </Row>
    </Surface>
    <Surface tone="page">
      <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--color-brand-text-muted)' }}>
        on the page — surface=&quot;card&quot;
      </div>
      <Row>
        <OptionChip surface="card">Cash</OptionChip>
        <OptionChip surface="card" selected>Card</OptionChip>
      </Row>
    </Surface>
  </div>
)

/** Sizes. `sm` suits a dense scrolling filter row; `md` is the usual chip. */
export const Sizes = () => (
  <Surface>
    <Row>
      <OptionChip size="sm">Small</OptionChip>
      <OptionChip size="md">Medium</OptionChip>
    </Row>
  </Surface>
)

/** `size="segment"` fills the row — for a set of equal choices such as an installment
 *  count. Prefer SegmentedControl when the set is small and fixed. */
export const Segments = () => (
  <Surface>
    <div style={{ display: 'flex', gap: 8 }}>
      <OptionChip size="segment">3</OptionChip>
      <OptionChip size="segment" selected>6</OptionChip>
      <OptionChip size="segment">12</OptionChip>
    </div>
  </Surface>
)

/** `as="trigger"` opens a sheet rather than toggling. `selected` then only means
 *  "a filter is applied", which is not a pressed state, so nothing is announced —
 *  pass `aria-expanded` yourself. */
export const Triggers = () => (
  <Surface tone="page">
    <Row>
      <OptionChip as="trigger" surface="card" size="sm" aria-haspopup="dialog" selected>
        Groceries
      </OptionChip>
      <OptionChip as="trigger" surface="card" size="sm" aria-haspopup="dialog">
        Payment
      </OptionChip>
    </Row>
  </Surface>
)
