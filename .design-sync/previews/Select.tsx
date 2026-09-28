import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from 'buddget'

/* A select is always a field inside a sheet or a filter bar, so the card is the context.
 * The open cells are authored open (`defaultOpen`) — a closed popup has no height and the
 * cell would read as broken. The popup is portalled and anchored to the trigger, so it
 * overlays the card the way it does in the app. */
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

const CATEGORIES = {
  food: 'Food',
  transport: 'Transport',
  bills: 'Bills & utilities',
  shopping: 'Shopping',
  enjoy: 'Enjoyment',
}

/** Open, with the category list the expense form offers. `items` is what lets
 * `SelectValue` print "Food" instead of the raw `food` value. */
export const CategoryPickerOpen = () => (
  <Card>
    <div>
      <span style={micro}>Category</span>
      <Select items={CATEGORIES} defaultValue="food" defaultOpen>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(CATEGORIES).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </Card>
)

/** Open with groups, anchored BELOW the trigger (`alignItemWithTrigger={false}`) so the
 * whole list is visible at once — labels and a separator split own accounts from borrowed
 * ones, so "is this my money or the bank's" is answered before you pick. */
export const GroupedAccountsOpen = () => (
  <Card>
    <div>
      <span style={micro}>Paid from</span>
      <Select
        items={{
          sab: 'SAB · Current',
          rajhi: 'Al Rajhi · Salary',
          barq: 'Barq wallet',
          visa: 'Visa 4417',
          tamara: 'Tamara (BNPL)',
        }}
        defaultValue="visa"
        defaultOpen
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start">
          <SelectGroup>
            <SelectLabel>Own money</SelectLabel>
            <SelectItem value="sab">SAB · Current</SelectItem>
            <SelectItem value="rajhi">Al Rajhi · Salary</SelectItem>
            <SelectItem value="barq">Barq wallet</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Borrowed</SelectLabel>
            <SelectItem value="visa">Visa 4417</SelectItem>
            <SelectItem value="tamara">Tamara (BNPL)</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  </Card>
)

/** Closed triggers: the placeholder state, both sizes, and disabled. `sm` (28px) is the
 * filter-bar size; `default` (32px) is the form size. */
export const TriggerStates = () => (
  <Card>
    <div>
      <span style={micro}>Empty (placeholder)</span>
      <Select>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose a category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="food">Food</SelectItem>
          <SelectItem value="transport">Transport</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div>
      <span style={micro}>Filter bar (size sm)</span>
      <Select items={{ sep: 'September 2026', aug: 'August 2026' }} defaultValue="sep">
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sep">September 2026</SelectItem>
          <SelectItem value="aug">August 2026</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div>
      <span style={micro}>Disabled (currency locked to the account)</span>
      <Select items={{ sar: 'SAR — Saudi riyal' }} defaultValue="sar" disabled>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sar">SAR — Saudi riyal</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </Card>
)
