import { MoneyDisplay } from 'buddget'

/* MoneyDisplay reads the base currency from settings (EGP by default) and converts whatever
 * currency it is handed. The three variants differ in what they do with the ORIGINAL currency:
 *   inline — base only, one mono line;
 *   card   — base only, plus the secondary currency in parentheses when that setting is on;
 *   table  — keeps the original as the headline and puts the base figure underneath.
 * `amountInPrimary` short-circuits the FX conversion, which is what the ledger passes so a row
 * can never disagree with the stored base-currency figure. */

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div
    style={{
      width: 440,
      background: 'var(--color-brand-card)',
      border: '1px solid var(--color-brand-border)',
      borderRadius: 16,
      padding: 16,
    }}
  >
    <p
      style={{
        margin: '0 0 12px',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--color-brand-text-muted)',
      }}
    >
      {title}
    </p>
    {children}
  </div>
)

/** `card` — the KPI figure: mono, large, base currency. This is the dashboard/subscriptions use. */
export const CardVariant = () => (
  <Card title="Spent this month">
    <MoneyDisplay
      amount={18450}
      currency="EGP"
      variant="card"
      primaryClassName="text-[28px] font-bold tracking-[-0.02em] text-[var(--color-brand-text-primary)]"
    />
    <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-brand-text-secondary)' }}>
      of a 24,000 budget · 11 days left
    </p>
  </Card>
)

/** `table` — a foreign-currency charge keeps its own headline and shows the base figure beneath,
 *  so the user recognises the bank's number and still sees what it cost them. */
export const TableVariantForeign = () => (
  <Card title="Ledger rows">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[
        { name: 'Half Million Coffee', note: 'Riyadh · Visa 4417', amount: 48, cur: 'SAR', base: 657 },
        { name: 'Notion annual', note: 'SAB Visa 4417', amount: 96, cur: 'USD', base: 4823 },
      ].map((r) => (
        <div key={r.name} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-brand-text-primary)' }}>
              {r.name}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-brand-text-muted)' }}>{r.note}</p>
          </div>
          <MoneyDisplay
            amount={r.amount}
            currency={r.cur}
            amountInPrimary={r.base}
            variant="table"
            className="text-end"
            primaryClassName="text-sm font-bold text-[var(--color-brand-text-primary)]"
          />
        </div>
      ))}
    </div>
  </Card>
)

/** `table` on a charge already in the base currency collapses to a single line — no redundant
 *  conversion row. Same variant, same call site, one fewer line of noise. */
export const TableVariantBaseCurrency = () => (
  <Card title="Ledger rows · base currency">
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-brand-text-primary)' }}>
          Talabat groceries
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-brand-text-muted)' }}>Cash</p>
      </div>
      <MoneyDisplay
        amount={845}
        currency="EGP"
        variant="table"
        className="text-end"
        primaryClassName="text-sm font-bold text-[var(--color-brand-text-primary)]"
      />
    </div>
  </Card>
)

/** `inline` — the default: one mono number in the base currency, sized by the caller. Used in
 *  summary strips where the currency is already stated by the surrounding copy. */
export const InlineVariant = () => (
  <Card title="Recurring">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[
        { label: 'Subscriptions / mo', amount: 1240, color: 'var(--color-brand-red)' },
        { label: 'Salary expected / mo', amount: 32000, color: 'var(--color-brand-green)' },
        { label: 'Debt payments / mo', amount: 4750, color: 'var(--color-brand-gold)' },
      ].map((r) => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--color-brand-text-secondary)' }}>{r.label}</span>
          <span style={{ color: r.color }}>
            <MoneyDisplay amount={r.amount} currency="EGP" className="text-sm font-semibold" />
          </span>
        </div>
      ))}
    </div>
  </Card>
)
