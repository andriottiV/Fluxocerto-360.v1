import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/qa",
  outputDir: "test-results/artifacts",
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ["line"],
    ["html", { outputFolder: "test-results/playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/playwright-results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "qa-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
