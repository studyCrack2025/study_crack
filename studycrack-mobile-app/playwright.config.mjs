import { defineConfig, devices } from '@playwright/test';

const previewPort = 4177;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: `http://127.0.0.1:${previewPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium'
      }
    }
  ],
  webServer: {
    command: `PORT=${previewPort} node ../tools/static-preview.mjs`,
    url: `http://127.0.0.1:${previewPort}/studycrack-mobile.html?screen=authLogin`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
