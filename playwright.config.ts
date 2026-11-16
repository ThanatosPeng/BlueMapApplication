import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5178",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "msedge",
      // 用系统已装的 Edge，避免下载 ~150MB 的 Chromium（本机下载被网络挡住）
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
  ],
  // 复用已在跑的 dev server；没有就自己起一个
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5178",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
