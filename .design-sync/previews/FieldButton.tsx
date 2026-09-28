import { FieldButton } from 'buddget'

const Form = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: 380,
      padding: 18,
      borderRadius: 18,
      background: 'var(--color-brand-card)',
      border: '1px solid var(--color-brand-border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}
  >
    {children}
  </div>
)

const Flag = () => <span style={{ fontSize: 18, lineHeight: 1 }}>🇪🇬</span>

/** Empty vs filled. The placeholder is styled but never announced as a value, so an
 *  empty control reads as empty — pair it with a Label the way you would an input. */
export const States = () => (
  <Form>
    <FieldButton placeholder="Pick a category" />
    <FieldButton value="Groceries" />
  </Form>
)

/** With a leading glyph — a currency flag, a card brand, a category icon. */
export const WithIcon = () => (
  <Form>
    <FieldButton value="EGP" icon={<Flag />} valueClassName="font-mono-numbers font-bold" />
  </Form>
)

/** `size="lg"` is 52px, for a trigger carrying two lines. The default 48px tracks
 *  `Input size="brand"`, so a field and a field-shaped trigger line up in a column. */
export const Sizes = () => (
  <Form>
    <FieldButton value="48px — matches Input" />
    <FieldButton size="lg" value="52px — a taller trigger" />
  </Form>
)

/** `affordance={null}` drops the chevron, for a trigger that opens a numpad rather
 *  than a list — the amount field on the expense sheet. */
export const AmountTrigger = () => (
  <Form>
    <FieldButton
      value="1,240.00"
      affordance={null}
      valueClassName="font-mono-numbers text-2xl font-bold tracking-[-0.02em]"
    />
  </Form>
)

/** Invalid. `aria-invalid` is not valid on a button, so the state is exposed as
 *  `data-invalid` — announce the problem with the error text beside the field. */
export const Invalid = () => (
  <Form>
    <FieldButton invalid placeholder="Pick a payment method" />
  </Form>
)
