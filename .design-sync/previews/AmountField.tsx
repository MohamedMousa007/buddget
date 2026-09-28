import { AmountField } from 'buddget'

/* AmountField is the trigger for the glass NumberPad, never a focusable <input> — an <input>
 * would summon the OEM keyboard the pad exists to replace. The blinking caret only shows while
 * the pad is open, so these cards show the closed states; tapping to open the pad is a gesture
 * that cannot render statically (see the NumberPad card for the open pad itself).
 *
 * Two skins, chosen by `className`: omit it for the standalone glass field (52px, dark #16161f),
 * pass the form's control class to make it match its <Input> siblings in a modal. */

const MODAL_CONTROL =
  'w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 py-3 h-12 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus-visible:outline-none disabled:opacity-50'

const Sheet = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: 440,
      background: 'var(--color-brand-card)',
      border: '1px solid var(--color-brand-border)',
      borderRadius: 16,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}
  >
    {children}
  </div>
)

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <span
      style={{
        display: 'block',
        marginBottom: 6,
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--color-brand-text-secondary)',
      }}
    >
      {label}
    </span>
    {children}
  </div>
)

/** Standalone glass skin — empty, then filled. The currency prefix sits in mono grey and the
 *  value in mono white at 24px, so a long amount stays readable at a glance. */
export const GlassField = () => (
  <Sheet>
    <Field label="Amount">
      <AmountField value="" onChange={() => {}} currency="EGP" placeholder="0.00" label="Amount" />
    </Field>
    <Field label="Amount · entered">
      <AmountField value="6200.00" onChange={() => {}} currency="EGP" label="Amount" />
    </Field>
  </Sheet>
)

/** With the modal control class it takes the same 48px height, radius and elevated fill as the
 *  <Input> above it — the field reads as one of the form's controls, not a bolt-on. */
export const InModalForm = () => (
  <Sheet>
    <Field label="Source name">
      <input
        readOnly
        value="Monthly salary"
        className={MODAL_CONTROL}
        style={{ fontFamily: 'var(--font-sans)' }}
      />
    </Field>
    <Field label="Expected per payday">
      <AmountField
        value="6200"
        onChange={() => {}}
        currency="SAR"
        label="Expected per payday"
        className={MODAL_CONTROL}
      />
    </Field>
  </Sheet>
)

/** `mode="pin"` reuses the field for a card's last 4 digits: no currency prefix, `0000` as the
 *  placeholder, and the pad it opens drops its decimal key. */
export const PinMode = () => (
  <Sheet>
    <Field label="Card last 4">
      <AmountField value="4417" onChange={() => {}} mode="pin" label="Card last 4 digits" />
    </Field>
    <Field label="Card last 4 · empty">
      <AmountField value="" onChange={() => {}} mode="pin" label="Card last 4 digits" />
    </Field>
  </Sheet>
)

/** `bare` drops the <Input> base so the field can live inside a wrapper that owns the border —
 *  the expense filter's min/max range is the real case. Disabled dims to 50%. */
export const BareAndDisabled = () => (
  <Sheet>
    <Field label="Amount between">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 48,
          padding: '0 14px',
          borderRadius: 12,
          border: '1px solid var(--color-brand-border)',
          background: 'var(--color-brand-elevated)',
        }}
      >
        <AmountField
          value="50"
          onChange={() => {}}
          bare
          className="font-mono-numbers w-16 bg-transparent text-sm text-[var(--color-brand-text-primary)]"
          aria-label="Minimum amount"
        />
        <span style={{ color: 'var(--color-brand-text-muted)' }}>→</span>
        <AmountField
          value="1200"
          onChange={() => {}}
          bare
          className="font-mono-numbers w-20 bg-transparent text-sm text-[var(--color-brand-text-primary)]"
          aria-label="Maximum amount"
        />
        <span style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--color-brand-text-muted)' }}>EGP</span>
      </div>
    </Field>
    <Field label="Amount · locked by SMS import">
      <AmountField value="845.00" onChange={() => {}} currency="EGP" className={MODAL_CONTROL} disabled />
    </Field>
  </Sheet>
)
