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
      // Modest floor against regression; raise it once the first measured run is in.
      thresholds: { lines: 40, statements: 40, functions: 40, branches: 30 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
