import { TransactionRow, CategoryIcon, IncomeTypeIcon } from 'buddget'

/* The app renders these edge-to-edge on a card surface, grouped by day, with a hairline
 * inset to 82px between rows. The wrapper below reproduces that context — a bare row on a
 * page background reads nothing like the real list. */
const List = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: 440,
      background: 'var(--color-brand-card)',
      borderTop: '1px solid var(--color-brand-border)',
      borderBottom: '1px solid var(--color-brand-border)',
    }}
  >
    {children}
  </div>
)

const Divider = () => (
  <div style={{ marginInlineStart: 82, height: 1, background: 'var(--color-brand-border)' }} />
)

const Cur = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-brand-text-muted)' }}>{children}</span>
)

/** A day of spending, exactly as the expenses list composes it. */
export const ExpenseDay = () => (
  <List>
    <TransactionRow
      icon={<CategoryIcon category="Food" className="h-5 w-5" />}
      iconBg="rgba(229,9,20,0.14)"
      iconFg="var(--color-brand-red)"
      caption="Food"
      captionColor="var(--color-brand-red)"
      title="Half Million Coffee"
      subtitle="SAB · Visa 4417"
      amount={<>−48.00 <Cur>SAR</Cur></>}
      sub="≈ $12.80"
    />
    <Divider />
    <TransactionRow
      icon={<CategoryIcon category="Transport" className="h-5 w-5" />}
      iconBg="rgba(77,163,255,0.16)"
      iconFg="#4DA3FF"
      caption="Transport"
      captionColor="#4DA3FF"
      title="Uber"
      subtitle="Apple Pay"
      amount={<>−31.50 <Cur>SAR</Cur></>}
    />
  </List>
)

/** Income reads the same row with a green amount and a `→ destination` subtitle. */
export const IncomeRow = () => (
  <List>
    <TransactionRow
      icon={<IncomeTypeIcon type="salary" className="h-5 w-5" />}
      iconBg="rgba(29,185,84,0.16)"
      iconFg="var(--color-brand-green)"
      caption="Salary"
      captionColor="var(--color-brand-green)"
      title="Monthly salary"
      titleBadge={
        <span
          style={{
            borderRadius: 999, padding: '2.5px 8px', fontSize: 9.5, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            background: 'rgba(29,185,84,0.16)', color: 'var(--color-brand-green)',
          }}
        >
          Recurring
        </span>
      }
      subtitle="→ Al Rajhi main"
      amount={<>+12,400.00 <Cur>SAR</Cur></>}
      amountColor="var(--color-brand-green)"
      sub="≈ $3,306.67"
    />
  </List>
)

/** Status rows: a refunded expense and a declined one, both dimmed and badged. */
export const StatusStates = () => (
  <List>
    <TransactionRow
      dimmed
      icon={<CategoryIcon category="Shopping" className="h-5 w-5" />}
      iconBg="rgba(167,139,250,0.16)"
      iconFg="#A78BFA"
      caption="Shopping"
      captionColor="#A78BFA"
      title="Jarir Bookstore"
      titleBadge={
        <span
          style={{
            borderRadius: 999, padding: '2.5px 8px', fontSize: 9.5, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            background: 'rgba(29,185,84,0.16)', color: '#1DB954',
          }}
        >
          Refunded
        </span>
      }
      subtitle={<span style={{ fontWeight: 600, color: '#1DB954' }}>↩ Returned Sep 14</span>}
      amount={<>−289.00 <Cur>SAR</Cur></>}
    />
    <Divider />
    <TransactionRow
      dimmed
      icon={<CategoryIcon category="Bills" className="h-5 w-5" />}
      iconBg="rgba(255,159,10,0.16)"
      iconFg="var(--color-brand-amber)"
      caption="Bills"
      captionColor="var(--color-brand-amber)"
      title="STC Postpaid"
      titleBadge={
        <span
          style={{
            borderRadius: 999, padding: '2.5px 8px', fontSize: 9.5, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            background: 'rgba(229,9,20,0.14)', color: '#F76D74',
          }}
        >
          Declined
        </span>
      }
      subtitle={<span style={{ fontWeight: 600 }}>✕ Blocked Sep 12</span>}
      amount={<>−175.00 <Cur>SAR</Cur></>}
    />
  </List>
)
