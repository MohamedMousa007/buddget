import { NumberPad, AmountField } from 'buddget'

/* The pad is `position: fixed; inset: 0` — it owns the whole viewport in the app. Each card here
 * wraps it in a phone-sized frame with a `transform`, which makes that frame the containing block
 * for the fixed positioning, so the pad docks to the bottom of the frame instead of the sheet.
 *
 * Controlled: `value` is the full string and every key press recomputes it through nextValue().
 * Press-and-hold backspace, the drag-to-dismiss handle and the :active key highlight are gestures
 * and do not appear in a static card. */

const Frame = ({ children, caption }: { children: React.ReactNode; caption: string }) => (
  <div
    style={{
      position: 'relative',
      width: 390,
      height: 430,
      overflow: 'hidden',
      borderRadius: 20,
      border: '1px solid var(--color-brand-border)',
      background: '#0b0b10',
      transform: 'translateZ(0)',
    }}
  >
    <p
      style={{
        margin: 0,
        padding: '14px 18px',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--color-brand-text-muted)',
      }}
    >
      {caption}
    </p>
    {children}
  </div>
)

/** The standalone pad: `showDisplay` gives it its own header, so the amount lives on the pad. The
 *  integer part is grouped with thousands separators as you type; decimals stay verbatim. */
export const AmountPad = () => (
  <Frame caption="Standalone · decimal">
    <NumberPad
      value="1250.5"
      onChange={() => {}}
      onDone={() => {}}
      mode="decimal"
      currency="EGP"
      label="Amount"
      showDisplay
    />
  </Frame>
)

/** Empty state: the header shows a dimmed 0 rather than a blank, so the pad never looks broken
 *  before the first key. */
export const AmountPadEmpty = () => (
  <Frame caption="Standalone · nothing typed yet">
    <NumberPad
      value=""
      onChange={() => {}}
      onDone={() => {}}
      mode="decimal"
      currency="SAR"
      label="Expected per payday"
      showDisplay
    />
  </Frame>
)

/** `showDisplay={false}` is the expense-form case — the AmountField above the pad already shows
 *  the live number, so a second copy inside the pad would just compete with it. */
export const KeysOnly = () => (
  <Frame caption="In a form · field above owns the number">
    <div style={{ padding: '0 16px' }}>
      <span
        style={{
          display: 'block',
          marginBottom: 6,
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-brand-text-muted)',
        }}
      >
        Amount
      </span>
      <AmountField value="845" onChange={() => {}} currency="EGP" label="Amount" />
    </div>
    <NumberPad value="845" onChange={() => {}} onDone={() => {}} mode="decimal" currency="EGP" />
  </Frame>
)

/** `pin` swaps the header for four dots and drops the decimal key — card last-4 entry. Three of
 *  four filled: filled dots take the brand red with a glow, empty ones sit at 82% scale. */
export const PinPad = () => (
  <Frame caption="Card last 4 · 3 of 4 entered">
    <NumberPad value="441" onChange={() => {}} onDone={() => {}} mode="pin" label="Card last 4 digits" showDisplay />
  </Frame>
)

/** `integer` keeps the header but blanks the decimal key — used where cents are meaningless
 *  (payday day-of-month, instalment counts). */
export const IntegerPad = () => (
  <Frame caption="Integer · no decimal key">
    <NumberPad
      value="12"
      onChange={() => {}}
      onDone={() => {}}
      mode="integer"
      currency="EGP"
      label="Number of instalments"
      showDisplay
    />
  </Frame>
)
