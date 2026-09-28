import { Input, Label } from 'buddget'

/* The app never shows a bare input: every one sits in a sheet field group on the
 * elevated surface, under a micro uppercase label. This wrapper is that surface. */
const Card = ({ children, width = 360 }: { children: React.ReactNode; width?: number }) => (
  <div
    style={{
      width,
      padding: 20,
      borderRadius: 18,
      background: 'var(--color-brand-card)',
      border: '1px solid var(--color-brand-border)',
      display: 'grid',
      gap: 16,
    }}
  >
    {children}
  </div>
)

const micro = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: 'var(--color-brand-text-muted)',
  display: 'block',
  marginBottom: 8,
}

/* The sheet-field class stack the savings/pocket forms apply verbatim:
 * 48px tall, 12px radius, elevated fill. */
const FIELD = 'h-12 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]'

/** The canonical composition — a pocket form's field group, exactly as
 * `PocketFormSheet` builds it (48px fields, mono for digits, native date picker). */
export const SheetFormFields = () => (
  <Card>
    <div>
      <span style={micro}>Pocket name</span>
      <Input defaultValue="Al Rajhi — Emergency" className={FIELD} />
    </div>
    <div>
      <span style={micro}>Last 4 digits</span>
      <Input defaultValue="2016" inputMode="numeric" className={`${FIELD} font-mono-numbers`} />
    </div>
    <div>
      <span style={micro}>Matures on</span>
      <Input type="date" defaultValue="2026-12-01" className={FIELD} />
    </div>
  </Card>
)

/** The DS default, untouched: 32px tall, 8px radius, transparent fill. Filled,
 * empty-with-placeholder, and paired with a Label. */
export const Default = () => (
  <Card>
    <div>
      <Label htmlFor="merchant" className="mb-1.5 block text-sm text-[var(--color-brand-text-primary)]">
        Merchant
      </Label>
      <Input id="merchant" defaultValue="Half Million Coffee" />
    </div>
    <Input placeholder="Search transactions" />
    <Input defaultValue="48.00" inputMode="decimal" className="font-mono-numbers" />
  </Card>
)

/** Non-interactive states. `readOnly` keeps full contrast (a matched SMS amount you
 * cannot edit); `disabled` dims and fills; `aria-invalid` turns the border red. */
export const States = () => (
  <Card>
    <div>
      <span style={micro}>Matched from SMS</span>
      <Input readOnly defaultValue="SAB · Visa 4417" className={FIELD} />
    </div>
    <div>
      <span style={micro}>Payday (locked while SMS is armed)</span>
      <Input disabled defaultValue="27" className={`${FIELD} font-mono-numbers`} />
    </div>
    <div>
      <span style={micro}>Amount</span>
      <Input aria-invalid defaultValue="-12.00" className={`${FIELD} font-mono-numbers`} />
      <p style={{ marginTop: 6, fontSize: 12, color: 'var(--color-brand-red)' }}>
        Enter an amount above 0.00 SAR
      </p>
    </div>
  </Card>
)

/** Amount row: the mono numeral face plus a trailing currency code, the shape every
 * money field in the app takes. */
export const AmountRow = () => (
  <Card width={320}>
    <div>
      <span style={micro}>Monthly salary</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Input defaultValue="18,500.00" inputMode="decimal" className={`${FIELD} font-mono-numbers flex-1`} />
        <span
          className="font-mono-numbers"
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-brand-text-secondary)' }}
        >
          SAR
        </span>
      </div>
      <p style={{ marginTop: 6, fontSize: 12, color: 'var(--color-brand-text-muted)' }}>≈ $4,933.00</p>
    </div>
  </Card>
)
