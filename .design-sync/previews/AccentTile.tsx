import { AccentTile, accentTileGridClass, accentTileGridStyle } from 'buddget'

const Dot = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="8" />
  </svg>
)

const Scroller = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 380, overflowX: 'auto', padding: 4 }}>{children}</div>
)

// Hex, not tokens: the tint goes through rgba(), which parses hex. These are the
// real accents from categoryGrid.ts.
const CATS = [
  { label: 'Groceries', accent: '#6FD48A' },
  { label: 'Transport', accent: '#4DA3FF' },
  { label: 'Dining', accent: '#F5A623' },
  { label: 'Bills', accent: '#FF6B6B' },
  { label: 'Health', accent: '#A78BFA' },
  { label: 'Fun', accent: '#EDC463' },
]

/** The category grid. This is the one selectable primitive tinted by the **item's own
 *  colour** rather than the brand: in a grid of twenty, the colour is how you find the
 *  one you want. Selection still changes the fill, the border and the glyph colour, so
 *  it never rests on hue alone. */
export const CategoryGrid = () => (
  <Scroller>
    <div role="radiogroup" aria-label="Category" className={accentTileGridClass} style={accentTileGridStyle}>
      {CATS.map((c, i) => (
        <AccentTile
          key={c.label}
          accent={c.accent}
          selected={i === 0}
          icon={<Dot />}
          label={c.label}
        />
      ))}
    </div>
  </Scroller>
)

/** `dashed` marks a tile that is not what it looks like — the non-spend categories
 *  (top-up, ATM, FX) move money rather than spend it, so they read differently at
 *  rest. `badge` puts a mark in the corner. */
export const NonSpend = () => (
  <Scroller>
    <div role="radiogroup" aria-label="Category" className={accentTileGridClass} style={accentTileGridStyle}>
      <AccentTile accent="#6FD48A" selected icon={<Dot />} label="Groceries" />
      <AccentTile accent="#4DA3FF" selected={false} dashed icon={<Dot />} label="Top up" />
      <AccentTile accent="#4DA3FF" selected={false} dashed icon={<Dot />} label="ATM" />
    </div>
  </Scroller>
)
