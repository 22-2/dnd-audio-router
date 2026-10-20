import { defineConfig } from "vitest/config";

// 単体・結合テスト（Vitest）。
// アプリ本体の vite.config.ts とは分けている。テストだけに jsdom を使い、
// 本番のバンドルの解決には影響させないため。
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "e2e/**"],
    // テスト同士の状態を持ち越さない。
    restoreMocks: true,
    clearMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
