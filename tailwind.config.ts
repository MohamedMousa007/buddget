import type { Config } from 'tailwindcss'

/**
 * Buddget design tokens — pairs with CSS variables in `src/app/globals.css`.
 * Loaded via `@config` in globals (Tailwind v4).
 */
/** v4: content paths are auto-detected; avoid duplicating `content` with `@config` in CSS. */
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          /* Teal identity (Revamp Kit v1). `primary` is the brand accent and the
             app's CTA colour; `red` is destructive-only. */
          primary: 'var(--color-brand-primary)',
          'primary-hover': 'var(--color-brand-primary-hover)',
          'primary-ink': 'var(--color-brand-primary-ink)',
          'primary-soft': 'var(--color-brand-primary-soft)',
          'on-primary': 'var(--color-brand-on-primary)',
          bg: 'var(--color-brand-bg)',
          card: 'var(--color-brand-card)',
          elevated: 'var(--color-brand-elevated)',
          sunken: 'var(--color-brand-sunken)',
          border: 'var(--color-brand-border)',
          'border-strong': 'var(--color-brand-border-strong)',
          red: 'var(--color-brand-red)',
          'red-hover': 'var(--color-brand-red-hover)',
          'red-soft': 'var(--color-brand-red-soft)',
          gold: 'var(--color-brand-gold)',
          green: 'var(--color-brand-green)',
          'green-hover': 'var(--color-brand-green-hover)',
          'green-soft': 'var(--color-brand-green-soft)',
          amber: 'var(--color-brand-amber)',
          'amber-soft': 'var(--color-brand-amber-soft)',
          'text-primary': 'var(--color-brand-text-primary)',
          'text-secondary': 'var(--color-brand-text-secondary)',
          'text-muted': 'var(--color-brand-text-muted)',
        },
        cat: {
          1: 'var(--color-cat-1)',
          2: 'var(--color-cat-2)',
          3: 'var(--color-cat-3)',
          4: 'var(--color-cat-4)',
          5: 'var(--color-cat-5)',
          6: 'var(--color-cat-6)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
} satisfies Config
