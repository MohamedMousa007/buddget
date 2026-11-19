import path from 'path'
import { defineConfig } from 'vitest/config'

process.env.TZ ??= 'Africa/Cairo'

export default defineConfig({
  test: { environment: 'node', include: ['e2e/sms/**/*.qa.test.ts'] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      'server-only': path.resolve(__dirname, '../../vitest.server-only-stub.ts'),
    },
  },
})
