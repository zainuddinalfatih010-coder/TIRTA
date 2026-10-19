import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'scientific-revision.spec.ts', workers: 1, timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:4174', channel: 'chrome', viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
  reporter: [['list'], ['json', { outputFile: 'evidence/scientific-revision/browser/results.json' }]],
  outputDir: 'evidence/scientific-revision/browser/test-output',
});
