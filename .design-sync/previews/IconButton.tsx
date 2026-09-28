import { IconButton } from 'buddget'

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>
)

const Card = ({ children, brand = false }: { children: React.ReactNode; brand?: boolean }) => (
  <div
    style={{
      width: 380,
      padding: 18,
      borderRadius: 18,
      background: brand ? 'var(--color-brand-primary)' : 'var(--color-brand-card)',
      border: brand ? 'none' : '1px solid var(--color-brand-border)',
    }}
  >
    {children}
  </div>
)

const X = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)
const Pencil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)
const Trash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
)
const Plus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

/** The variants. `ghost` is the default — the glyph carries the affordance and there
 *  is no resting fill. */
export const Variants = () => (
  <Card>
    <Row>
      <IconButton aria-label="Close"><X /></IconButton>
      <IconButton aria-label="Edit" variant="tinted"><Pencil /></IconButton>
      <IconButton aria-label="Add" variant="outlined"><Plus /></IconButton>
      <IconButton aria-label="Add" variant="solid"><Plus /></IconButton>
      <IconButton aria-label="Ask Buddgy" variant="brand"><Plus /></IconButton>
      <IconButton aria-label="Delete" variant="danger"><Trash /></IconButton>
    </Row>
  </Card>
)

/** Sizes. `sm` is 32px **visually** but still has a 44px hit area, so a dense row can
 *  stay dense without failing the tap-target rule. `xl` is the hero control — the
 *  biometric unlock, the record button. */
export const Sizes = () => (
  <Card>
    <Row>
      <IconButton aria-label="Close" variant="tinted" size="sm"><X /></IconButton>
      <IconButton aria-label="Close" variant="tinted" size="md"><X /></IconButton>
      <IconButton aria-label="Close" variant="tinted" size="lg"><X /></IconButton>
      <IconButton aria-label="Close" variant="tinted" size="xl"><X /></IconButton>
    </Row>
  </Card>
)

/** Round, for a sheet header or a card's ⋮ — and `danger` at `md` rather than `sm`,
 *  because a delete's hit area must not reach over the row beside it. */
export const Round = () => (
  <Card>
    <Row>
      <IconButton aria-label="Close" variant="tinted" shape="round"><X /></IconButton>
      <IconButton aria-label="Edit" variant="outlined" shape="round"><Pencil /></IconButton>
      <IconButton aria-label="Delete" variant="danger" shape="round"><Trash /></IconButton>
    </Row>
  </Card>
)

/** `onBrand` is for a glyph on a teal or gradient surface, where a token would
 *  disappear into the fill. */
export const OnBrand = () => (
  <Card brand>
    <Row>
      <IconButton aria-label="Close" variant="onBrand" shape="round"><X /></IconButton>
      <IconButton aria-label="Previous" variant="onBrand" size="sm" shape="round"><Plus /></IconButton>
    </Row>
  </Card>
)
