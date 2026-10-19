import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4173', channel: 'chrome', viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
  reporter: [['list'], ['json', { outputFile: 'evidence/browser-results.json' }]],
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
});
