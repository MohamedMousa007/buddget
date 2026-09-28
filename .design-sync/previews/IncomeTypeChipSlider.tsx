import { IncomeTypeChipSlider } from 'buddget'

/* The add/edit-income sheet's `sourceType` control: all 7 manual types on one horizontally
 * scrolling row, the active chip filled with that type's accent tint. The right-edge fade +
 * chevron are painted with `--color-brand-card`, so the slider must sit on a card surface for
 * the hint to blend instead of showing as a grey block. */

// `labels` is Dictionary['income'] — only the sourceType* keys are read by incomeSourceTypeLabel.
const LABELS = {
  sourceTypeSalary: 'Salary',
  sourceTypeBonus: 'Bonus',
  sourceTypeSideHustle: 'Side hustle',
  sourceTypeInvestment: 'Investment',
  sourceTypeSavings: 'Savings',
  sourceTypeDebt: 'Borrowed',
  sourceTypeGift: 'Gift',
  sourceTypeRefund: 'Refund',
  sourceTypeOther: 'Other',
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

/** The sheet field: uppercase label above, slider on the modal card surface. */
const Field = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <div
    style={{
      width: 440,
      background: 'var(--color-brand-card)',
      border: '1px solid var(--color-brand-border)',
      borderRadius: 16,
      padding: 16,
    }}
  >
    <span
      style={{
        display: 'block',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--color-brand-text-secondary)',
      }}
    >
      Income type
    </span>
    <div style={{ marginTop: 6 }}>{children}</div>
    {hint ? (
      <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--color-brand-text-muted)' }}>{hint}</p>
    ) : null}
  </div>
)

/** Default for a new source — Salary, indigo. */
export const SalarySelected = () => (
  <Field>
    <IncomeTypeChipSlider value="salary" onChange={() => {}} labels={LABELS} />
  </Field>
)

/** Each type owns its accent, so the fill colour is the selection cue, not just position. */
export const SideHustleSelected = () => (
  <Field>
    <IncomeTypeChipSlider value="side_hustle" onChange={() => {}} labels={LABELS} />
  </Field>
)

/** The slider only ever shows four chips at phone width, so this card is widened past the app's
 *  390px to expose all seven at once — the full accent set, with a late type (Refund) active. */
export const FullRowAccents = () => (
  <div
    style={{
      width: 740,
      background: 'var(--color-brand-card)',
      border: '1px solid var(--color-brand-border)',
      borderRadius: 16,
      padding: 16,
    }}
  >
    <span
      style={{
        display: 'block',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--color-brand-text-secondary)',
      }}
    >
      Income type
    </span>
    <div style={{ marginTop: 6 }}>
      <IncomeTypeChipSlider value="refund" onChange={() => {}} labels={LABELS} />
    </div>
    <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--color-brand-text-muted)' }}>
      At the app's 390px only the first four chips fit — the right-edge fade and chevron are what
      tell the user the row scrolls.
    </p>
  </div>
)

/** A source linked to a debt or savings account has its type locked: the sheet dims the whole
 *  slider and kills pointer events rather than disabling each chip. */
export const Locked = () => (
  <Field hint="Type is fixed while this income is linked to a debt.">
    <div style={{ opacity: 0.6, pointerEvents: 'none' }}>
      <IncomeTypeChipSlider value="debt" onChange={() => {}} labels={LABELS} />
    </div>
  </Field>
)
