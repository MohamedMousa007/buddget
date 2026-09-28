import { Switch, Label } from 'buddget'

const Card = ({ children, width = 380 }: { children: React.ReactNode; width?: number }) => (
  <div
    style={{
      width,
      padding: 20,
      borderRadius: 18,
      background: 'var(--color-brand-card)',
      border: '1px solid var(--color-brand-border)',
      display: 'grid',
      gap: 18,
    }}
  >
    {children}
  </div>
)

/** The settings composition: label + hint on the left, switch pinned right, aligned to
 * the first line of text. Ported from the Security and App Preferences sections. */
export const SettingsRows = () => (
  <Card>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Label className="text-sm text-[var(--color-brand-text-primary)]">Track spending from bank SMS</Label>
        <p style={{ fontSize: 12, color: 'var(--color-brand-text-muted)', marginTop: 2, lineHeight: 1.5 }}>
          Reads SAB and Al Rajhi alerts on this device and files each one automatically.
        </p>
      </div>
      <Switch defaultChecked />
    </div>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Label className="text-sm text-[var(--color-brand-text-primary)]">Email code on a new device</Label>
        <p style={{ fontSize: 12, color: 'var(--color-brand-text-muted)', marginTop: 2, lineHeight: 1.5 }}>
          A browser we do not recognise must clear a 6-digit code after the password.
        </p>
      </div>
      <Switch />
    </div>
  </Card>
)

/** The bordered toggle row: the whole row is the tap target (44px+ tall), so the switch
 * itself is display-only — `pointer-events-none` is deliberate, not a mistake. */
export const ToggleRowCard = () => (
  <Card>
    {[
      { title: 'Also add as a payment method', sub: 'So you can spend from it too', on: true },
      { title: 'Round up every purchase', sub: 'The change goes to Emergency fund', on: false },
    ].map((r) => (
      <div
        key={r.title}
        className="flex w-full items-center justify-between rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3.5 text-left"
      >
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-brand-text-primary)', margin: 0 }}>
            {r.title}
          </p>
          <p style={{ fontSize: 12, color: 'var(--color-brand-text-muted)', margin: '2px 0 0' }}>{r.sub}</p>
        </div>
        <Switch checked={r.on} className="pointer-events-none shrink-0" />
      </div>
    ))}
  </Card>
)

/** Both sizes and the disabled state. `default` is 32×18px; `sm` is 24×14px, used inside
 * dense rows such as a category's per-item overrides. */
export const SizesAndStates = () => (
  <Card width={320}>
    {[
      { label: 'default · on', node: <Switch defaultChecked /> },
      { label: 'default · off', node: <Switch /> },
      { label: 'sm · on', node: <Switch size="sm" defaultChecked /> },
      { label: 'sm · off', node: <Switch size="sm" /> },
      { label: 'disabled · on', node: <Switch defaultChecked disabled /> },
      { label: 'disabled · off', node: <Switch disabled /> },
    ].map((r) => (
      <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: 'var(--color-brand-text-secondary)' }}>{r.label}</span>
        {r.node}
      </div>
    ))}
  </Card>
)
