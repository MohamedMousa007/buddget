import { Badge } from 'buddget'

const Card = ({ children, width = 380 }: { children: React.ReactNode; width?: number }) => (
  <div
    style={{
      width,
      padding: 18,
      borderRadius: 18,
      background: 'var(--color-brand-card)',
      border: '1px solid var(--color-brand-border)',
    }}
  >
    {children}
  </div>
)

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>
)

/** The six variants. `default` is the solid brand-red fill; `destructive` is the soft
 * red-tinted style (not the loud one) the app uses for overdue/failed states. */
export const Variants = () => (
  <Card>
    <Row>
      <Badge>Over budget</Badge>
      <Badge variant="destructive">3 days late</Badge>
      <Badge variant="secondary">Recurring</Badge>
      <Badge variant="outline">BNPL</Badge>
      <Badge variant="ghost">Draft</Badge>
      <Badge variant="link">Details</Badge>
    </Row>
  </Card>
)

/** Status pills as the app tints them — the green "linked" pill from the SMS guide is a
 * `secondary` badge with the brand-green token layered on, because the DS carries no
 * green variant. */
export const StatusPills = () => (
  <Card>
    <Row>
      <Badge
        variant="secondary"
        className="gap-1 border-transparent bg-[var(--color-brand-green)]/15 text-[var(--color-brand-green)]"
      >
        SMS linked
      </Badge>
      <Badge
        variant="secondary"
        className="border-transparent bg-[var(--color-brand-amber)]/15 text-[var(--color-brand-amber)]"
      >
        Awaiting payday
      </Badge>
      <Badge variant="destructive">Payment missed</Badge>
      <Badge variant="outline">Autopay off</Badge>
    </Row>
  </Card>
)

/** On a list row: the badge qualifies the merchant title and never competes with the
 * amount, so it stays on the secondary/outline end. */
export const OnListRows = () => (
  <Card>
    <div style={{ display: 'grid', gap: 14 }}>
      {[
        { name: 'Netflix', meta: 'Subscription · SAB', tag: 'Recurring', variant: 'secondary' as const, amount: '−56.00' },
        { name: 'IKEA Riyadh', meta: 'Tamara · 2 of 4', tag: 'BNPL', variant: 'outline' as const, amount: '−437.50' },
        { name: 'Jarir Bookstore', meta: 'Visa 4417 · unmatched SMS', tag: 'Needs review', variant: 'destructive' as const, amount: '−219.00' },
      ].map((r) => (
        <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-brand-text-primary)' }}>{r.name}</span>
              <Badge variant={r.variant}>{r.tag}</Badge>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-brand-text-muted)', marginTop: 2 }}>{r.meta}</div>
          </div>
          <span
            className="font-mono-numbers"
            style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-brand-red-text)' }}
          >
            {r.amount}
          </span>
        </div>
      ))}
    </div>
  </Card>
)

/** As a count on a section header — the only place the solid red fill is used for a
 * badge, because it is carrying an attention count rather than a label. */
export const CountOnSectionHeader = () => (
  <Card>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <h3
        className="font-heading"
        style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-brand-text-primary)', margin: 0 }}
      >
        Unreviewed SMS
      </h3>
      <Badge className="font-mono-numbers">12</Badge>
      <span style={{ marginInlineStart: 'auto' }}>
        <Badge variant="link">Review all</Badge>
      </span>
    </div>
  </Card>
)
