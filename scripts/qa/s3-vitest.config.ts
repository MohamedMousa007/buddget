import path from 'path'
import { defineConfig } from 'vitest/config'

process.env.TZ ??= 'Africa/Cairo'

// Runs only the S3 dry-run dump (the main config includes src/ tests only).
export default defineConfig({
  test: { environment: 'node', include: ['scripts/qa/s3-dryrun-dump.test.ts'] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      'server-only': path.resolve(__dirname, '../../vitest.server-only-stub.ts'),
    },
  },
})
