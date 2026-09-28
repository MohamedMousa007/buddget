import { Tabs, TabsList, TabsTrigger, TabsContent } from 'buddget'

/* `data-horizontal` below is a shim for a bug in the DS source, not a styling choice:
 * `tabs.tsx` writes its orientation classes as `data-horizontal:` / `data-horizontal/tabs:`,
 * which Tailwind v4 compiles to `[data-horizontal]`, while Base UI's Tabs.Root emits
 * `data-orientation="horizontal"`. Nothing matches, so the root never stacks, the list
 * never gets its 32px height, and the line variant's underline pseudo-element never gets
 * a size or position. Setting the attribute the CSS actually looks for restores the
 * component's own intended rendering. Fix the selectors in the source and delete this.
 * See .design-sync/learnings/primitives.md. */
const HORIZONTAL = { 'data-horizontal': '' }

const Card = ({ children, width = 400 }: { children: React.ReactNode; width?: number }) => (
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

const Stat = ({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) => (
  <div style={{ paddingTop: 14 }}>
    <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-brand-text-muted)' }}>
      {label}
    </div>
    <div
      className="font-mono-numbers"
      style={{ fontSize: 28, fontWeight: 600, color: color ?? 'var(--color-brand-text-primary)', marginTop: 4 }}
    >
      {value}
    </div>
    <div style={{ fontSize: 12, color: 'var(--color-brand-text-muted)', marginTop: 4 }}>{sub}</div>
  </div>
)

/** The income surface's two-number split: projected against actual, on the filled
 * `default` list. The active tab lifts onto the card surface. */
export const ProjectedVsActual = () => (
  <Card>
    <Tabs defaultValue="actual" {...HORIZONTAL}>
      <TabsList>
        <TabsTrigger value="projected">Projected</TabsTrigger>
        <TabsTrigger value="actual">Received</TabsTrigger>
      </TabsList>
      <TabsContent value="projected">
        <Stat label="Expected in September" value="18,500.00" sub="2 paydays · 5th and 27th" />
      </TabsContent>
      <TabsContent value="actual">
        <Stat
          label="Received so far"
          value="9,250.00"
          sub="1 of 2 paydays landed · 27 Sep awaiting"
          color="var(--color-brand-green)"
        />
      </TabsContent>
    </Tabs>
  </Card>
)

/** `variant="line"` — the underlined ledger filter, used where the tab strip sits
 * directly above a list and a filled pill would fight the rows. */
export const LineVariant = () => (
  <Card>
    <Tabs defaultValue="expenses" {...HORIZONTAL}>
      <TabsList variant="line">
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="expenses">Expenses</TabsTrigger>
        <TabsTrigger value="income">Income</TabsTrigger>
        <TabsTrigger value="transfers">Transfers</TabsTrigger>
      </TabsList>
      <TabsContent value="all">
        <Stat label="September" value="−6,418.20" sub="84 transactions" color="var(--color-brand-red-text)" />
      </TabsContent>
      <TabsContent value="expenses">
        <Stat label="Spent in September" value="−6,418.20" sub="62 transactions · Food is the largest at 1,240.00" color="var(--color-brand-red-text)" />
      </TabsContent>
      <TabsContent value="income">
        <Stat label="Income in September" value="9,250.00" sub="1 salary · 1 transfer in" color="var(--color-brand-green)" />
      </TabsContent>
      <TabsContent value="transfers">
        <Stat label="Moved in September" value="2,000.00" sub="Own transfers are not spending" />
      </TabsContent>
    </Tabs>
  </Card>
)

/** Disabled tab: a period with no data is unreachable rather than hidden, so the strip
 * keeps a stable width across months. */
export const WithDisabledTab = () => (
  <Card width={360}>
    <Tabs defaultValue="month" {...HORIZONTAL}>
      <TabsList>
        <TabsTrigger value="week">This week</TabsTrigger>
        <TabsTrigger value="month">This month</TabsTrigger>
        <TabsTrigger value="year" disabled>
          This year
        </TabsTrigger>
      </TabsList>
      <TabsContent value="week">
        <Stat label="Week to date" value="−1,092.40" sub="11 transactions" color="var(--color-brand-red-text)" />
      </TabsContent>
      <TabsContent value="month">
        <Stat label="Month to date" value="−6,418.20" sub="62 transactions · 3 days left" color="var(--color-brand-red-text)" />
      </TabsContent>
      <TabsContent value="year">
        <Stat label="Year to date" value="—" sub="Not enough history yet" />
      </TabsContent>
    </Tabs>
  </Card>
)
