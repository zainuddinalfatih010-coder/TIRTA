import { defineConfig } from "@playwright/test";

const externalBaseUrl = process.env.TIRTA_RESCUE_URL;
const evidenceRoot = process.env.TIRTA_GOLDEN_EVIDENCE ?? "evidence/production";
if (!externalBaseUrl) process.env.TIRTA_PRODUCTION_PREVIEW = "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "production-golden.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 90000,
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:4173",
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    trace: "off",
  },
  reporter: [["list"], ["json", { outputFile: `${evidenceRoot}/browser-results.json` }]],
  outputDir: `${evidenceRoot}/test-output`,
  webServer: externalBaseUrl ? undefined : {
    command: "node scripts/production-preview.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
