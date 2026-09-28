import { EmptyState } from 'buddget'

/* Every empty state in the app sits inside the card it replaces — goals list,
 * subscriptions list, the dashboard's category block — so the card is the context. */
const Card = ({ children, width = 400 }: { children: React.ReactNode; width?: number }) => (
  <div
    style={{
      width,
      borderRadius: 18,
      background: 'var(--color-brand-card)',
      border: '1px solid var(--color-brand-border)',
      overflow: 'hidden',
    }}
  >
    {children}
  </div>
)

/* The app styles empty-state CTAs as raw brand-red fills, not DS Button variants. */
const Cta = ({ children }: { children: React.ReactNode }) => (
  <button
    type="button"
    className="px-5 py-2.5 rounded-xl bg-[var(--color-brand-red)] text-sm font-semibold text-white"
  >
    {children}
  </button>
)

/** With an icon, a description and a primary action — the goals page's empty list. */
export const WithAction = () => (
  <Card>
    <EmptyState
      icon="🎯"
      title="No goals yet"
      description="Set a target — a Hajj fund, a new car, six months of expenses — and Buddget tracks every deposit against it."
      action={<Cta>Add your first goal</Cta>}
    />
  </Card>
)

/** Title and description only — the dashboard's recent-expenses block, where the action
 * lives in the page header instead. */
export const TitleAndDescription = () => (
  <Card>
    <EmptyState
      icon="💸"
      title="Nothing spent yet this month"
      description="Transactions appear here as soon as a bank SMS lands or you add one by hand."
      className="py-10"
    />
  </Card>
)

/** Title only — the tightest form, for a filtered list that came back empty. The filter
 * chips above already explain why. */
export const TitleOnly = () => (
  <Card width={360}>
    <EmptyState title="No transactions match these filters" className="py-8" />
  </Card>
)

/** A secondary, link-shaped action — the category block sends you to budget setup rather
 * than committing anything itself. */
export const SecondaryAction = () => (
  <Card>
    <EmptyState
      icon="🗂️"
      title="No categories to show"
      description="Give Food, Transport and Bills a monthly limit and this block fills in as you spend."
      action={
        <button
          type="button"
          className="px-4 py-2 rounded-xl border border-[var(--color-brand-border)] text-sm font-medium text-[var(--color-brand-text-primary)]"
        >
          Set up budget →
        </button>
      }
    />
  </Card>
)
