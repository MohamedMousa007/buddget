import { Scrim } from 'buddget'

const Stage = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div style={{ width: 380 }}>
    <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--color-brand-text-muted)' }}>{label}</div>
    <div
      style={{
        position: 'relative',
        height: 180,
        borderRadius: 18,
        overflow: 'hidden',
        border: '1px solid var(--color-brand-border)',
        background: 'var(--color-brand-bg)',
      }}
    >
      <div style={{ padding: 16, fontSize: 13, color: 'var(--color-brand-text-secondary)' }}>
        Content behind the scrim
      </div>
      {children}
      <div
        style={{
          position: 'absolute',
          insetInline: 16,
          bottom: 16,
          padding: 14,
          borderRadius: 14,
          background: 'var(--color-brand-card)',
          border: '1px solid var(--color-brand-border)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-brand-text-primary)',
        }}
      >
        The sheet
      </div>
    </div>
  </div>
)

/** The tap-to-dismiss backdrop. It is a real `<button>`, not a `<div onClick>`, so it
 *  is keyboard reachable and announced — a div leaves keyboard users with no way out
 *  and nothing telling them it is there. It does NOT handle Escape or Android back;
 *  those belong to the overlay, via ModalShell or useDismissable. */
export const Tones = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <Stage label="default — 40% black, blurred">
      <Scrim label="Close" />
    </Stage>
    <Stage label="light — for a centred modal">
      <Scrim label="Close" tone="light" />
    </Stage>
    <Stage label="heavy — for a full-bleed sheet">
      <Scrim label="Close" tone="heavy" blur={false} />
    </Stage>
  </div>
)

/** `tone="none"` is an invisible click-catcher, for dismissing a popover menu without
 *  dimming the screen. It never blurs — that would stop it being invisible. */
export const Invisible = () => (
  <Stage label='none — an invisible catcher'>
    <Scrim label="Close menu" tone="none" />
  </Stage>
)
