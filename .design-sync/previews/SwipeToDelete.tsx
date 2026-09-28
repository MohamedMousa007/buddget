import { SwipeToDelete, TransactionRow, CategoryIcon, IncomeTypeIcon } from 'buddget'

/* Reveal-and-tap row wrapper. The drag itself cannot be shown in a static card, so each export
 * pins `openSide` to the resting offset the gesture snaps to (112px) — that is the state the
 * user actually taps. Wrapped in the expenses/income list context (card surface + hairline
 * inset to 82px), because the row's own background IS the card and a bare row reads as broken. */

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

const Link2 = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M9 17H7A5 5 0 0 1 7 7h2" />
    <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
)

const Coffee = () => (
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
)

const Fuel = () => (
  <TransactionRow
    icon={<CategoryIcon category="Transport" className="h-5 w-5" />}
    iconBg="rgba(77,163,255,0.16)"
    iconFg="#4DA3FF"
    caption="Transport"
    captionColor="#4DA3FF"
    title="Sasco fuel"
    subtitle="Apple Pay"
    amount={<>−96.00 <Cur>SAR</Cur></>}
  />
)

const Payout = () => (
  <TransactionRow
    icon={<IncomeTypeIcon type="side_hustle" className="h-5 w-5" />}
    iconBg="rgba(77,163,255,0.16)"
    iconFg="#4DA3FF"
    caption="Side hustle"
    captionColor="#4DA3FF"
    title="Upwork payout"
    subtitle="→ Al Rajhi main"
    amount={<>+1,550.00 <Cur>SAR</Cur></>}
    amountColor="var(--color-brand-green)"
  />
)

/** Closed: the wrapper is invisible and the row is just a tappable expense. */
export const Resting = () => (
  <List>
    <SwipeToDelete openSide={null} onOpenChange={() => {}} onDelete={() => {}} deleteLabel="Delete">
      <Coffee />
    </SwipeToDelete>
    <Divider />
    <SwipeToDelete openSide={null} onOpenChange={() => {}} onDelete={() => {}} deleteLabel="Delete">
      <Fuel />
    </SwipeToDelete>
  </List>
)

/** Swiped left past the deliberate threshold: the red Delete panel is exposed and waits for a
 *  second, explicit tap — the swipe alone never deletes. */
export const DeleteRevealed = () => (
  <List>
    <SwipeToDelete openSide="left" onOpenChange={() => {}} onDelete={() => {}} deleteLabel="Delete">
      <Coffee />
    </SwipeToDelete>
  </List>
)

/** Only one row is open at a time: the list drives `openSide`, so opening this one closed its
 *  neighbour. */
export const OneOpenAtATime = () => (
  <List>
    <SwipeToDelete openSide={null} onOpenChange={() => {}} onDelete={() => {}} deleteLabel="Delete">
      <Coffee />
    </SwipeToDelete>
    <Divider />
    <SwipeToDelete openSide="left" onOpenChange={() => {}} onDelete={() => {}} deleteLabel="Delete">
      <Fuel />
    </SwipeToDelete>
  </List>
)

/** Income rows add a rightward reveal: swipe the other way for the green Assign action that
 *  links the payout to a recurring source. */
export const AssignRevealed = () => (
  <List>
    <SwipeToDelete
      openSide="right"
      onOpenChange={() => {}}
      onDelete={() => {}}
      deleteLabel="Delete"
      rightAction={{ label: 'Assign', icon: <Link2 />, onAction: () => {} }}
    >
      <Payout />
    </SwipeToDelete>
  </List>
)
