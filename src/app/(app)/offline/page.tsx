export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-brand-bg)]">
      <div className="text-center max-w-sm space-y-2">
        <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)]">You&apos;re offline</h1>
        <p className="text-sm text-[var(--color-brand-text-muted)]">Check your connection and try again.</p>
      </div>
    </div>
  )
}
