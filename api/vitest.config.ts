import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Integration tests share one live DB; run files serially to avoid clashes.
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
  },
});
