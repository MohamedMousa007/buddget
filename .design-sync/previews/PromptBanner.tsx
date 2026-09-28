import { PromptBanner } from 'buddget'

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 360 }}>{children}</div>
)

/**
 * The unmatched-income prompt. This is the component's reason to exist: a stray
 * credit and an unfilled payday make one paycheck read as two things, and this
 * is the only CTA that resolves it. Note it names the specific candidate rather
 * than reporting a count — the matching is already computed, so the banner
 * should do the thinking, not the user.
 */
export const MatchIncome = () => (
  <Frame>
    <PromptBanner
      tone="brand"
      icon={<span style={{ fontSize: 16, fontWeight: 700 }}>↓</span>}
      title="1,240 SAR arrived on Sep 25 — is this your Al Rajhi salary?"
      description="Linking it fills the payday and stops it counting twice."
      confirmLabel="Yes, link it"
      onConfirm={() => {}}
      dismissLabel="Keep separate"
      onDismiss={() => {}}
    />
  </Frame>
)

/**
 * An overdue payday. This is the one moment the payday machinery earns space:
 * income defaults to "received", so while a salary is late the headline number
 * is silently over-reporting.
 */
export const OverduePayday = () => (
  <Frame>
    <PromptBanner
      tone="warning"
      icon={<span style={{ fontSize: 16, fontWeight: 700 }}>!</span>}
      title="Monthly salary is 3 days late"
      description="Your income total still assumes it arrived."
      confirmLabel="Mark received"
      onConfirm={() => {}}
      dismissLabel="Not yet"
      onDismiss={() => {}}
    />
  </Frame>
)

/** A destructive warning — over budget. Single action, no dismiss. */
export const OverBudget = () => (
  <Frame>
    <PromptBanner
      tone="negative"
      icon={<span style={{ fontSize: 16, fontWeight: 700 }}>×</span>}
      title="Food is 12% over budget with 10 days left"
      confirmLabel="Adjust budget"
      onConfirm={() => {}}
    />
  </Frame>
)

/** Minimal: one line, one action, no icon or description. */
export const Minimal = () => (
  <Frame>
    <PromptBanner
      title="4 bank messages waiting for review"
      confirmLabel="Review"
      onConfirm={() => {}}
      dismissLabel="Later"
      onDismiss={() => {}}
    />
  </Frame>
)
