import path from 'path'
import { configDefaults, defineConfig } from 'vitest/config'

// The product runs on Cairo wall-clock time; pin the suite to it (CI also runs a New York leg via the TZ env).
process.env.TZ ??= 'Africa/Cairo'

export default defineConfig({
  test: {
    testTimeout: 15_000,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // Live-network golden set: only `npm run eval:ai` (RUN_AI_EVAL=1) runs it.
    exclude: process.env.RUN_AI_EVAL ? configDefaults.exclude : [...configDefaults.exclude, '**/*.eval.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/utils/**',
        'src/lib/savings/**',
        'src/lib/debt/**',
        'src/lib/sms/**',
        'src/lib/supabase/remote/**',
      ],
      exclude: ['**/*.test.ts', '**/__tests__/**'],
      reporter: ['text-summary', 'lcov'],
      // A ratchet under the measured run (2026-11-02: lines 83.6, statements 81.1, functions 84.5, branches 74.4): raise it
      // when coverage rises, never lower it. Only these directories are measured; UI, routes and the store are not.
      thresholds: { lines: 75, statements: 73, functions: 75, branches: 65 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './vitest.server-only-stub.ts'),
    },
  },
})
