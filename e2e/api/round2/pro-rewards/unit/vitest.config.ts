import path from 'path'
import { defineConfig } from 'vitest/config'

process.env.TZ ??= 'Africa/Cairo'

/** S8g selling-OFF checks with the billing switch mocked (no network). Run: npx vitest run --config e2e/api/round2/pro-rewards/unit/vitest.config.ts */
export default defineConfig({
  test: { environment: 'node', include: ['e2e/api/round2/pro-rewards/unit/**/*.test.{ts,tsx}'] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../../../../src'),
      'server-only': path.resolve(__dirname, '../../../../../vitest.server-only-stub.ts'),
    },
  },
})
