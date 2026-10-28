import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
  },
});
