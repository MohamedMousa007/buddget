import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
  Input,
  Switch,
  Badge,
} from 'buddget'

/* Every cell is authored OPEN (`defaultOpen`): the content is portalled and fixed to the
 * viewport, so a closed sheet would render nothing at all. The backdrop filling the cell
 * is the real component — that is how a sheet looks on a phone. */

const micro = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: 'var(--color-brand-text-muted)',
  display: 'block',
  marginBottom: 8,
}

const FIELD = 'h-12 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]'

/* App convention: a sheet's committing action is a raw brand-red fill, not a DS Button. */
const Commit = ({ children }: { children: React.ReactNode }) => (
  <button
    type="button"
    className="w-full text-white"
    style={{ height: 52, borderRadius: 14, background: 'var(--color-brand-red)', fontWeight: 600, fontSize: 15 }}
  >
    {children}
  </button>
)

/** `side="bottom"` — the phone default. Header, a field group, and a footer that pins the
 * committing action to the bottom of the sheet. */
export const BottomSheet = () => (
  <Sheet defaultOpen>
    <SheetContent side="bottom" className="rounded-t-3xl">
      <SheetHeader>
        <SheetTitle>Add to savings</SheetTitle>
        <SheetDescription>Moving money between your own pockets is a transfer, not spending.</SheetDescription>
      </SheetHeader>
      <div style={{ display: 'grid', gap: 14, padding: '0 16px' }}>
        <div>
          <span style={micro}>Amount</span>
          <Input defaultValue="2,000.00" inputMode="decimal" className={`${FIELD} font-mono-numbers`} />
        </div>
        <div>
          <span style={micro}>Into</span>
          <div className="flex h-12 items-center gap-2 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 text-sm font-medium text-[var(--color-brand-text-primary)]">
            Emergency fund
            <span className="font-mono-numbers text-[var(--color-brand-text-muted)]">··2016</span>
          </div>
        </div>
        <div>
          <span style={micro}>Note</span>
          <Input placeholder="What was it for?" className={FIELD} />
        </div>
      </div>
      <SheetFooter>
        <Commit>Deposit 2,000.00 SAR</Commit>
      </SheetFooter>
    </SheetContent>
  </Sheet>
)

/** `side="right"` — the filter drawer. Capped at `sm:max-w-sm`, full height, and the footer
 * carries the apply/reset pair. */
export const RightSideSheet = () => (
  <Sheet defaultOpen>
    <SheetContent side="right">
      <SheetHeader>
        <SheetTitle>Filter transactions</SheetTitle>
        <SheetDescription>September 2026 · 62 results</SheetDescription>
      </SheetHeader>
      <div style={{ display: 'grid', gap: 16, padding: '0 16px' }}>
        <div>
          <span style={micro}>Category</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Badge>Food</Badge>
            <Badge variant="outline">Transport</Badge>
            <Badge variant="outline">Bills</Badge>
            <Badge variant="outline">Shopping</Badge>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, color: 'var(--color-brand-text-primary)' }}>Hide own transfers</span>
          <Switch defaultChecked />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, color: 'var(--color-brand-text-primary)' }}>Unmatched SMS only</span>
          <Switch />
        </div>
      </div>
      <SheetFooter>
        <Commit>Show 62 transactions</Commit>
        <SheetClose
          className="w-full text-sm font-medium text-[var(--color-brand-text-secondary)]"
          style={{ height: 44 }}
        >
          Reset filters
        </SheetClose>
      </SheetFooter>
    </SheetContent>
  </Sheet>
)

/** The confirm shape: title, consequence spelled out in the description, and a
 * destructive-then-cancel footer. `showCloseButton={false}` forces a deliberate choice. */
export const ConfirmSheet = () => (
  <Sheet defaultOpen>
    <SheetContent side="bottom" showCloseButton={false} className="rounded-t-3xl">
      <SheetHeader>
        <SheetTitle>Delete this expense?</SheetTitle>
        <SheetDescription>
          Half Million Coffee · −48.00 SAR · 15 Sep. The bank SMS it was matched from goes back to unreviewed.
        </SheetDescription>
      </SheetHeader>
      <SheetFooter>
        <Commit>Delete expense</Commit>
        <SheetClose
          className="w-full text-sm font-medium text-[var(--color-brand-text-secondary)]"
          style={{ height: 44 }}
        >
          Keep it
        </SheetClose>
      </SheetFooter>
    </SheetContent>
  </Sheet>
)
