import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [
    ["list"],
    ["json", { outputFile: ".dev-checks/playwright-results.json" }],
  ],
  outputDir: ".dev-checks/playwright",
  use: {
    baseURL: process.env.CITY_BROWSER_URL ?? "http://127.0.0.1:5180",
    viewport: { width: 1280, height: 800 },
    headless: true,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  webServer: process.env.CITY_BROWSER_URL
    ? undefined
    : {
        command:
          "npm run preview -- --port 5180 --strictPort --outDir .release-stage",
        url: "http://127.0.0.1:5180",
        reuseExistingServer: false,
      },
});
