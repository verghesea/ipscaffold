/**
 * Playwright Configuration for E2E Tests
 *
 * Run E2E tests: npm run test:e2e
 * Run with UI: npm run test:e2e:ui
 */

import { defineConfig, devices } from '@playwright/test';

// Use environment variable or default for base URL
const baseURL = process.env.BASE_URL || 'http://localhost:5000';

export default defineConfig({
  // Test directory
  testDir: '.',

  // Test file patterns
  testMatch: '**/*.e2e.ts',

  // Global timeout for each test
  timeout: 30000,

  // Expect timeout (for assertions)
  expect: {
    timeout: 5000,
  },

  // Fail the entire run after first failure (useful for CI)
  fullyParallel: true,

  // Number of retries on CI
  retries: process.env.CI ? 2 : 0,

  // Parallel workers
  workers: process.env.CI ? 1 : undefined,

  // Reporter
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
  ],

  // Shared settings for all projects
  use: {
    // Base URL for navigation
    baseURL,

    // Trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Viewport size
    viewport: { width: 1280, height: 720 },
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment for additional browser testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Run local dev server before tests if not already running
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120000, // 2 minutes for server to start
      },
});
