import { defineConfig, devices } from "@playwright/test";

// E2E テスト（Playwright）。
// Vite の開発サーバーを相手にブラウザで UI を操作する。Tauri の実機は使わないので、
// Windows でも Linux の CI でも同じように動く。
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // 失敗を1回だけ再試行するのは CI のみ。ローカルでは失敗をそのまま見せる。
  retries: process.env.CI ? 2 : 0,
  // 各テストが独立したページを開くので、並列で安全に走らせる。
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:1420",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 860 },
    // OS のテーマに依存しないよう、ライトテーマに固定する。
    colorScheme: "light",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
