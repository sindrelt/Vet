import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
config({ path: '.env.local', quiet: true });
process.env.E2E_ADMIN_PASSWORD ||= randomBytes(32).toString('hex');
const db = process.env.E2E_DATABASE_URL;
if (!db || !new URL(db).pathname.endsWith('_test'))
  throw new Error('Sett E2E_DATABASE_URL til en separat database med navn som slutter på _test');
execFileSync('node', ['--import', 'tsx', 'scripts/migrate.ts'], {
  env: { ...process.env, DATABASE_URL: db },
  stdio: 'pipe',
});
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.CHROME_PATH },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'npm run start -- --port 3001',
    url: 'http://localhost:3001/api/health',
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      DATABASE_URL: db,
      ADMIN_USER: 'admin',
      ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
      APP_ORIGIN: 'http://localhost:3001',
    },
  },
});
