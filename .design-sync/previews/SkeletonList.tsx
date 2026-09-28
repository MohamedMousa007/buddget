import { SkeletonList } from 'buddget'

/* Every page renders this inside its own `p-4` gutter while `dataReady === false`,
 * on the app background — never on a card, because it stands in for the whole list. */
const Page = ({ children, width = 400 }: { children: React.ReactNode; width?: number }) => (
  <div
    style={{
      width,
      padding: 16,
      borderRadius: 18,
      background: 'var(--color-brand-bg)',
      border: '1px solid var(--color-brand-border)',
    }}
  >
    {children}
  </div>
)

/** The default: 5 pulsing 64px rows. This is what `/goals`, `/debts`, `/income`,
 * `/savings` and `/expenses` render before the store is hydrated. */
export const Default = () => (
  <Page>
    <SkeletonList />
  </Page>
)

/** `rows={8}` — the dashboard and settings ask for eight so the skeleton reaches the
 * fold on a phone and no stale data flashes underneath. */
export const DashboardEightRows = () => (
  <Page>
    <SkeletonList rows={8} />
  </Page>
)

/** Short form under a live header: the page chrome renders immediately and only the list
 * region waits, which is how a section-level load reads. */
export const UnderASectionHeader = () => (
  <Page>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
      <h3
        className="font-heading"
        style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-brand-text-primary)', margin: 0 }}
      >
        Recent expenses
      </h3>
      <span style={{ fontSize: 12, color: 'var(--color-brand-text-muted)' }}>September</span>
    </div>
    <SkeletonList rows={3} />
  </Page>
)
