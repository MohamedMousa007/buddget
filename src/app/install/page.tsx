'use client'

import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InstallButton } from '@/components/pwa/InstallButton'

export default function InstallPage() {
  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] text-white px-4 py-8 lg:py-12">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <Link
            href="/"
            className="text-sm text-[var(--color-brand-red)] hover:text-[var(--color-brand-red-hover)] mb-3 inline-block"
          >
            ← Back to Buddget
          </Link>
          <h1 className="text-2xl font-bold font-heading">Install Buddget</h1>
          <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">
            Add Buddget to your home screen or desktop for faster access.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-5 space-y-4">
          <p className="text-sm text-[var(--color-brand-text-secondary)]">
            Use the button below when your browser supports one-tap install. Otherwise follow the steps for your
            device.
          </p>
          <InstallButton variant="button" className="!w-full" />
        </div>

        <Tabs defaultValue="iphone" className="w-full">
          <TabsList
            variant="line"
            className="w-full justify-start gap-1 bg-[var(--color-brand-elevated)]/50 border border-[var(--color-brand-border)] rounded-xl p-1"
          >
            <TabsTrigger value="iphone" className="flex-1 data-active:text-white text-[var(--color-brand-text-muted)]">
              iPhone
            </TabsTrigger>
            <TabsTrigger value="android" className="flex-1 data-active:text-white text-[var(--color-brand-text-muted)]">
              Android
            </TabsTrigger>
            <TabsTrigger value="desktop" className="flex-1 data-active:text-white text-[var(--color-brand-text-muted)]">
              Desktop
            </TabsTrigger>
          </TabsList>

          <TabsContent value="iphone" className="mt-4 space-y-3 text-sm text-[var(--color-brand-text-secondary)]">
            <ol className="list-decimal list-inside space-y-2 leading-relaxed">
              <li>Open Buddget in Safari (Chrome on iOS cannot install PWAs the same way).</li>
              <li>Tap the Share button <span className="text-white font-medium">(square with arrow)</span> at the bottom.</li>
              <li>Scroll and tap <span className="text-white font-medium">Add to Home Screen</span>.</li>
              <li>Tap <span className="text-white font-medium">Add</span> in the top right.</li>
            </ol>
          </TabsContent>

          <TabsContent value="android" className="mt-4 space-y-3 text-sm text-[var(--color-brand-text-secondary)]">
            <ol className="list-decimal list-inside space-y-2 leading-relaxed">
              <li>Open Buddget in Chrome.</li>
              <li>Tap the menu <span className="text-white font-medium">(⋮)</span> in the top right.</li>
              <li>Tap <span className="text-white font-medium">Install app</span> or <span className="text-white font-medium">Add to Home screen</span>.</li>
              <li>Confirm when prompted.</li>
            </ol>
            <p className="text-xs text-[var(--color-brand-text-muted)] pt-2">
              Some devices show an install banner automatically; you can also use that.
            </p>
          </TabsContent>

          <TabsContent value="desktop" className="mt-4 space-y-3 text-sm text-[var(--color-brand-text-secondary)]">
            <ol className="list-decimal list-inside space-y-2 leading-relaxed">
              <li>Open Buddget in Chrome, Edge, or another Chromium browser.</li>
              <li>Look for the install icon in the address bar or use the browser menu.</li>
              <li>Choose <span className="text-white font-medium">Install</span> or <span className="text-white font-medium">Create shortcut</span>.</li>
            </ol>
            <p className="text-xs text-[var(--color-brand-text-muted)] pt-2">
              Safari on macOS does not support the same PWA install flow; use Chrome or Edge for a desktop app
              experience.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
