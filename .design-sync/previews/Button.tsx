import { Button } from 'buddget'

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>
)

/** The six variants. `default` is the solid brand-red fill the app uses for its primary CTA;
 * `destructive` is the softer red-tinted style, not the loud one. */
export const Variants = () => (
  <Row>
    <Button>Add expense</Button>
    <Button variant="destructive">Delete</Button>
    <Button variant="secondary">Skip</Button>
    <Button variant="outline">Cancel</Button>
    <Button variant="ghost">Later</Button>
    <Button variant="link">Learn more</Button>
  </Row>
)

/** Height presets. `icon` is the square icon-only button. */
export const Sizes = () => (
  <Row>
    <Button size="xs">Extra small</Button>
    <Button size="sm">Small</Button>
    <Button>Default</Button>
    <Button size="lg">Large</Button>
    <Button size="icon" aria-label="Add">+</Button>
  </Row>
)

/** Disabled across the variants that carry a fill. */
export const Disabled = () => (
  <Row>
    <Button disabled>Add expense</Button>
    <Button variant="destructive" disabled>Delete</Button>
    <Button variant="outline" disabled>Cancel</Button>
  </Row>
)

/** How the app actually uses it: one full-width committing action at the bottom of a sheet. */
export const FullWidthCta = () => (
  <div style={{ width: 320, display: 'grid', gap: 8 }}>
    <Button style={{ width: '100%' }}>Add expense</Button>
    <Button variant="ghost" style={{ width: '100%' }}>Cancel</Button>
  </div>
)
