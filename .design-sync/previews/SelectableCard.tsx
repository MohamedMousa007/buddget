import { SelectableCard } from 'buddget'

const Sheet = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: 380,
      padding: 18,
      borderRadius: 18,
      background: 'var(--color-brand-card)',
      border: '1px solid var(--color-brand-border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}
  >
    {children}
  </div>
)

const Chip = ({ color }: { color: string }) => (
  <span
    style={{
      display: 'flex',
      height: 36,
      width: 36,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      background: `color-mix(in srgb, ${color} 16%, transparent)`,
      color,
      fontWeight: 800,
      fontSize: 12,
    }}
  >
    ₽
  </span>
)

const Title = ({ t, s }: { t: string; s: string }) => (
  <span style={{ minWidth: 0, flex: 1 }}>
    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-brand-text-primary)' }}>{t}</span>
    <span style={{ display: 'block', fontSize: 11, color: 'var(--color-brand-text-muted)' }}>{s}</span>
  </span>
)

/** `layout="row"` — the default. An icon, then a title and subtitle: a provider, an
 *  account, a currency. Selection is a teal fill AND border, announced as
 *  `aria-checked` because these are radios. Wrap the set in `role="radiogroup"`. */
export const Rows = () => (
  <Sheet>
    <div role="radiogroup" aria-label="Pick an account" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SelectableCard selected>
        <Chip color="var(--color-brand-primary)" />
        <Title t="Main pocket" s="12,400 EGP" />
      </SelectableCard>
      <SelectableCard>
        <Chip color="var(--color-cat-2)" />
        <Title t="Travel fund" s="3,100 EGP" />
      </SelectableCard>
    </div>
  </Sheet>
)

/** `as="action"` for a card that opens something rather than being chosen. It gets no
 *  radio role, so it is not announced as selectable. */
export const Actions = () => (
  <Sheet>
    <SelectableCard as="action">
      <Chip color="var(--color-brand-green)" />
      <Title t="Add a pocket" s="Set a goal and a colour" />
    </SelectableCard>
  </Sheet>
)

/** `layout="tile"` stacks the icon over a centred label, for a grid of equal choices. */
export const Tiles = () => (
  <Sheet>
    <div role="radiogroup" aria-label="Type" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
      <SelectableCard layout="tile" selected>
        <Chip color="var(--color-brand-primary)" />
        <span style={{ fontSize: 12, fontWeight: 600 }}>Bank</span>
      </SelectableCard>
      <SelectableCard layout="tile">
        <Chip color="var(--color-cat-2)" />
        <span style={{ fontSize: 12, fontWeight: 600 }}>Gold</span>
      </SelectableCard>
      <SelectableCard layout="tile">
        <Chip color="var(--color-cat-4)" />
        <span style={{ fontSize: 12, fontWeight: 600 }}>Crypto</span>
      </SelectableCard>
    </div>
  </Sheet>
)

/** `as="checkbox"` for an independent toggle — several can be on at once, so it is
 *  announced as checked rather than selected. `layout="list"` is the compact row. */
export const Checkboxes = () => (
  <Sheet>
    <div role="group" aria-label="Categories" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <SelectableCard as="checkbox" layout="list" selected>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Groceries</span>
      </SelectableCard>
      <SelectableCard as="checkbox" layout="list">
        <span style={{ fontSize: 13, fontWeight: 600 }}>Transport</span>
      </SelectableCard>
    </div>
  </Sheet>
)
