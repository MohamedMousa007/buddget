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
          bg: 'var(--color-brand-bg)',
          card: 'var(--color-brand-card)',
          elevated: 'var(--color-brand-elevated)',
          border: 'var(--color-brand-border)',
          red: 'var(--color-brand-red)',
          'red-hover': 'var(--color-brand-red-hover)',
          gold: 'var(--color-brand-gold)',
          green: 'var(--color-brand-green)',
          amber: 'var(--color-brand-amber)',
          'text-primary': 'var(--color-brand-text-primary)',
          'text-secondary': 'var(--color-brand-text-secondary)',
          'text-muted': 'var(--color-brand-text-muted)',
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
