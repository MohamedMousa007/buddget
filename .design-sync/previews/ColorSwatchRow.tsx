import { ColorSwatchRow } from 'buddget'

/* The selected swatch is marked with a WHITE 2px border and sits under a white-ish outer ring,
 * so this control is designed for a dark surface — the app uses it inside PocketFormSheet. On the
 * light capture background it would read as invisible rings, hence the dark frame. */
const Sheet = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ width: 380, borderRadius: 22, background: '#16161d', padding: 18 }}>
    <p
      style={{
        margin: '0 0 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)',
      }}
    >
      {label}
    </p>
    {children}
  </div>
)

/** The default shared palette (CARD_COLORS, 25 swatches), as the pocket and payment-method
 * forms show it. The first swatch carries the white selection ring. */
export const DefaultPalette = () => (
  <Sheet label="Card colour">
    <ColorSwatchRow value="#2E5AAC" onChange={() => {}} />
  </Sheet>
)

/** Selection is the only state. Same row, a value further along the palette — the ring moves
 * to the green swatch. Keep the chosen value inside the first ~8 entries of CARD_COLORS: the row
 * scrolls horizontally, and a selection further along is simply off-frame in the card, making the
 * cell indistinguishable from the unselected one. */
export const SelectionMoves = () => (
  <Sheet label="Card colour">
    <ColorSwatchRow value="#2E8B57" onChange={() => {}} />
  </Sheet>
)

/** `colors` overrides the palette — here the brand set, for a surface that should stay on-brand. */
export const BrandPaletteOverride = () => (
  <Sheet label="Accent">
    <ColorSwatchRow
      value="#F5C842"
      onChange={() => {}}
      colors={['#E50914', '#1DB954', '#F5C842', '#FF9F0A', '#4DA3FF', '#A78BFA', '#2DD4BF']}
    />
  </Sheet>
)

/** A value outside the palette: no swatch carries the ring. Consumers may store any hex, so
 * this "nothing matched" state is reachable and must stay legible. */
export const NothingSelected = () => (
  <Sheet label="Card colour">
    <ColorSwatchRow value="#123456" onChange={() => {}} />
  </Sheet>
)
