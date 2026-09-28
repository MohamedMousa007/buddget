import { PaydayTimeline } from 'buddget'

/* One timeline model for every cadence. It lives inside the glass hero card and paints in
 * white/status colors, so it must be previewed on that dark surface. Green rail = paid up to
 * the last realized payday (realized needs BOTH an eventId and a paid status); the moving dot
 * pulses toward the next open one; a missed payday gets a red glow bracketing it on the rail. */

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
  key,
  date,
  dueDate: date,
  status,
  amount: 6200,
  currency: 'SAR',
  actionable: true,
  ...extra,
})

const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dateLabel = (o: Occ) => `${M[Number(o.date.slice(5, 7)) - 1]} ${Number(o.date.slice(8, 10))}`
const amountLabel = (o: Occ) => `${(o.amount / 1000).toFixed(1)}k ${o.currency}`
const statusBracket = (o: Occ) =>
  o.daysLate
    ? ` (${o.daysLate}d late)`
    : o.status === 'late'
      ? ' (Late!)'
      : o.status === 'missed'
        ? ' (Missed)'
        : o.status === 'partial'
          ? ' (Partial)'
          : ''

/** The card slot the timeline occupies: `mb-2 mt-2.5` inside the 16px-padded glass hero. */
const Slot = ({ caption, children }: { caption: string; children: React.ReactNode }) => (
  <div
    style={{
      width: 440,
      padding: '14px 16px 16px',
      borderRadius: 16,
      color: '#fff',
      background: 'linear-gradient(158deg, #6366F122, rgba(255,255,255,.045) 55%), #0f0f15',
      border: '1px solid rgba(255,255,255,.08)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07), 0 8px 24px -12px rgba(0,0,0,.6)',
    }}
  >
    <p
      style={{
        margin: '0 0 14px',
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'rgba(255,255,255,.55)',
      }}
    >
      {caption}
    </p>
    {children}
  </div>
)

/** A lone monthly payday centres on a full runway; already received, so the rail stays quiet. */
export const MonthlyReceived = () => (
  <Slot caption="Monthly · 27">
    <PaydayTimeline
      occurrences={[occ('salary@2026-09-27', '2026-09-27', 'received', { eventId: 'e1' })]}
      dateLabel={dateLabel}
      amountLabel={amountLabel}
      statusBracket={statusBracket}
    />
  </Slot>
)

/** Biweekly: first payday paid, second still awaiting — the pulse travels toward it, and with
 *  ≤2 paydays there is room for the per-payday amount under each dot. */
export const BiweeklyHalfPaid = () => (
  <Slot caption="Biweekly · 5 / 20">
    <PaydayTimeline
      occurrences={[
        occ('salary@2026-09-05', '2026-09-05', 'received', { eventId: 'e1' }),
        occ('salary@2026-09-20', '2026-09-20', 'awaiting'),
      ]}
      dateLabel={dateLabel}
      amountLabel={amountLabel}
      statusBracket={statusBracket}
    />
  </Slot>
)

/** Weekly packs four dots, so labels alternate above and below the rail and amounts drop out.
 *  Two paid, one late, one still to come. */
export const WeeklyMixed = () => (
  <Slot caption="Weekly · 2 / 9 / 16 / 23">
    <PaydayTimeline
      occurrences={[
        occ('gig@2026-09-02', '2026-09-02', 'received', { eventId: 'e1', amount: 1550 }),
        occ('gig@2026-09-09', '2026-09-09', 'received', { eventId: 'e2', amount: 1550 }),
        occ('gig@2026-09-16', '2026-09-16', 'late', { amount: 1550 }),
        occ('gig@2026-09-23', '2026-09-23', 'awaiting', { amount: 1550, actionable: false }),
      ]}
      dateLabel={dateLabel}
      amountLabel={amountLabel}
      statusBracket={statusBracket}
    />
  </Slot>
)

/** Every status at once: a partial top-up, a payday the user marked missed (red glow bracketing
 *  the dot), one paid late, and the next one waiting its turn. */
export const AllStatuses = () => (
  <Slot caption="Weekly · retainer — every state">
    <PaydayTimeline
      occurrences={[
        occ('ret@2026-08-04', '2026-08-04', 'partial', { eventId: 'e1', amount: 3000 }),
        occ('ret@2026-08-11', '2026-08-11', 'missed'),
        occ('ret@2026-08-18', '2026-08-18', 'received', { eventId: 'e2', daysLate: 3 }),
        occ('ret@2026-08-25', '2026-08-25', 'awaiting', { actionable: false }),
      ]}
      dateLabel={dateLabel}
      amountLabel={amountLabel}
      statusBracket={statusBracket}
    />
  </Slot>
)

/** Tapping a dot selects it: the status fill brightens and picks up a glow, and its label goes
 *  full-opacity semibold — the card's footer then swaps to that payday's actions. */
export const PaydaySelected = () => (
  <Slot caption="Biweekly · 5 / 20 — Sep 20 tapped">
    <PaydayTimeline
      occurrences={[
        occ('salary@2026-09-05', '2026-09-05', 'received', { eventId: 'e1' }),
        occ('salary@2026-09-20', '2026-09-20', 'awaiting'),
      ]}
      dateLabel={dateLabel}
      amountLabel={amountLabel}
      statusBracket={statusBracket}
      selectedKey="salary@2026-09-20"
      onSelect={() => {}}
    />
  </Slot>
)
