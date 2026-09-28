import { AccountChip } from 'buddget'

/* AccountChip is a fragment, not a box: it emits a 16px glyph chip + a truncating label and
 * expects the caller's flex row. The app's caller is the glass hero card's `paymentLine` slot —
 *   <div className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-white/55">
 * so the chip's white/12 glyph tile only reads correctly on that dark surface. */

const PAYMENT_METHODS = [
  { id: 'pm_rajhi', name: 'Al Rajhi main', type: 'bank_account', currency: 'SAR', color: '#1DB954', isDefault: true },
  { id: 'pm_sab_visa', name: 'SAB Visa 4417', type: 'credit_card', currency: 'SAR', color: '#4DA3FF', isDefault: false },
  { id: 'pm_barq', name: 'Barq wallet', type: 'wallet', currency: 'SAR', color: '#F5C842', isDefault: false },
  { id: 'pm_cash', name: 'Cash', type: 'cash', currency: 'EGP', color: '#A3A3A3', isDefault: false },
  { id: 'pm_tabby', name: 'Tabby', type: 'bnpl', currency: 'SAR', color: '#F472B6', isDefault: false },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any[]

/** The glass hero card's payment slot, reproduced verbatim. */
const PaymentSlot = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
      fontSize: 11,
      lineHeight: 1.2,
      color: 'rgba(255,255,255,.55)',
    }}
  >
    {children}
  </div>
)

const GlassCard = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: 440,
      padding: 16,
      borderRadius: 16,
      color: '#fff',
      background: 'linear-gradient(158deg, #6366F122, rgba(255,255,255,.045) 55%), #0f0f15',
      border: '1px solid rgba(255,255,255,.08)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07), 0 8px 24px -12px rgba(0,0,0,.6)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}
  >
    {children}
  </div>
)

/** The common case: income lands in a registered payment method, so it wears that type's glyph. */
export const OnPaymentMethod = () => (
  <GlassCard>
    <div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Monthly salary</p>
      <p className="font-mono-numbers" style={{ margin: '2px 0 4px', fontSize: 11, color: 'rgba(255,255,255,.65)' }}>
        Monthly · 27
      </p>
      <PaymentSlot>
        <AccountChip label="Al Rajhi main" acct={{ paymentMethodId: 'pm_rajhi' }} paymentMethods={PAYMENT_METHODS} />
      </PaymentSlot>
    </div>
  </GlassCard>
)

/** Linked destinations override the method glyph: a piggy bank for savings, a bank for debt. */
export const LinkedDestinations = () => (
  <GlassCard>
    <div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Vault auto-save</p>
      <PaymentSlot>
        <AccountChip
          label="Emergency fund"
          acct={{ linkedSavingsAccountId: 'sav_emergency' }}
          paymentMethods={PAYMENT_METHODS}
        />
      </PaymentSlot>
    </div>
    <div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Borrowed from Ahmed</p>
      <PaymentSlot>
        <AccountChip label="Ahmed loan" acct={{ linkedDebtId: 'debt_ahmed' }} paymentMethods={PAYMENT_METHODS} />
      </PaymentSlot>
    </div>
  </GlassCard>
)

/** One chip per payment-method type — the glyph is what distinguishes them at 11px. */
export const GlyphPerType = () => (
  <GlassCard>
    {[
      { id: 'pm_rajhi', label: 'Al Rajhi main' },
      { id: 'pm_sab_visa', label: 'SAB Visa 4417' },
      { id: 'pm_barq', label: 'Barq wallet' },
      { id: 'pm_cash', label: 'Cash' },
      { id: 'pm_tabby', label: 'Tabby' },
    ].map((m) => (
      <PaymentSlot key={m.id}>
        <AccountChip label={m.label} acct={{ paymentMethodId: m.id }} paymentMethods={PAYMENT_METHODS} />
      </PaymentSlot>
    ))}
  </GlassCard>
)

/** No method on the source, or an id that no longer resolves, falls back to the wallet glyph — and
 *  a long account name truncates rather than pushing the amount off the card. */
export const FallbackAndTruncation = () => (
  <GlassCard>
    <PaymentSlot>
      <AccountChip label="Main account" acct={{}} paymentMethods={PAYMENT_METHODS} />
    </PaymentSlot>
    <div style={{ maxWidth: 170 }}>
      <PaymentSlot>
        <AccountChip
          label="Al Rajhi joint household current account"
          acct={{ paymentMethodId: 'pm_rajhi' }}
          paymentMethods={PAYMENT_METHODS}
        />
      </PaymentSlot>
    </div>
  </GlassCard>
)
