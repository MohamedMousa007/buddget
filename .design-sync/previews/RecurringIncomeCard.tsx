import { RecurringIncomeCard, Button } from 'buddget'

/* One card per recurring income source. The payday chips along the bottom are the card's
 * point: tapping one reveals contextual actions in `footer`, which the page swaps per
 * occurrence status. Each export below is one of those footer states. */

type Occ = {
  key: string
  date: string
  dueDate: string
  status: 'received' | 'late' | 'partial' | 'missed' | 'awaiting'
  amount: number
  currency: string
  eventId?: string
  daysLate?: number
  actionable: boolean
}

const occ = (key: string, date: string, status: Occ['status'], extra: Partial<Occ> = {}): Occ => ({
  key, date, dueDate: date, status, amount: 6200, currency: 'SAR', actionable: true, ...extra,
})

const biweekly: Occ[] = [
  occ('s1@2026-09-05', '2026-09-05', 'received', { eventId: 'e1' }),
  occ('s1@2026-09-20', '2026-09-20', 'awaiting'),
]

const fmtDay = (o: Occ) => {
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${M[Number(o.date.slice(5, 7)) - 1]} ${Number(o.date.slice(8, 10))}`
}
const amountLabel = (o: Occ) => `${(o.amount / 1000).toFixed(1)}k ${o.currency}`

const Progress = () => (
  <>
    6.2k SAR of 12.4k SAR · <span style={{ color: '#35D46F' }}>6.2k SAR to come</span>
  </>
)

const Pay = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <span style={{ width: 6, height: 6, borderRadius: 999, background: '#1DB954' }} />
    Al Rajhi main
  </span>
)

const base = {
  sourceType: 'salary' as const,
  name: 'Monthly salary',
  cadenceLine: 'Biweekly · 5 / 20',
  paymentLine: <Pay />,
  expectedBig: '12,400',
  expectedCurrency: 'SAR',
  expectedTag: 'Expected / mo',
  progressPct: 50,
  progressLine: <Progress />,
  occurrences: biweekly,
  dateLabel: fmtDay,
  amountLabel,
  onEdit: () => {},
  editAriaLabel: 'Edit source',
}

const Hint = ({ children }: { children: React.ReactNode }) => (
  <p style={{ width: '100%', textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: 0 }}>
    {children}
  </p>
)

const Pair = ({ left, right }: { left: string; right: string }) => (
  /* The page styles this pair as solid brand fills on the glass card rather than as DS Button
   * variants — `destructive` reads as a tinted outline against dark glass, not a red CTA. */
  <div style={{ display: 'grid', width: '100%', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
    <Button style={{ width: '100%', background: 'var(--color-brand-red)', color: '#fff' }}>{left}</Button>
    <Button style={{ width: '100%', background: 'var(--color-brand-green)', color: '#fff' }}>{right}</Button>
  </div>
)

/** Nothing selected — the resting state, prompting the tap. */
export const Resting = () => (
  <RecurringIncomeCard {...base} footer={<Hint>Tap a payday to settle it</Hint>} />
)

/** An open payday selected: skip it, or log the money. */
export const PaydaySelected = () => (
  <RecurringIncomeCard
    {...base}
    selectedKey="s1@2026-09-20"
    footer={<Pair left="Missed" right="Received" />}
  />
)

/** A payday already received: remove the money, or correct the amount. */
export const AlreadyReceived = () => (
  <RecurringIncomeCard
    {...base}
    selectedKey="s1@2026-09-05"
    footer={<Pair left="Delete" right="Edit" />}
  />
)

/** Late and partial paydays carry a status suffix on the chip label. */
export const LateAndPartial = () => {
  const rows: Occ[] = [
    occ('s2@2026-08-25', '2026-08-25', 'partial', { eventId: 'e2', amount: 5000 }),
    occ('s2@2026-09-25', '2026-09-25', 'late'),
  ]
  const bracket = (o: Occ) =>
    o.status === 'late' ? ' (Late!)' : o.status === 'partial' ? ' (Partial)' : ''
  return (
    <RecurringIncomeCard
      {...base}
      name="Consulting retainer"
      sourceType="side_hustle"
      cadenceLine="Monthly · 25"
      expectedBig="8,000"
      progressPct={62}
      progressLine={<>5.0k SAR of 8.0k SAR · 3.0k SAR to come</>}
      occurrences={rows}
      statusBracket={bracket}
      footer={<Hint>Settle the earlier payday first</Hint>}
    />
  )
}
