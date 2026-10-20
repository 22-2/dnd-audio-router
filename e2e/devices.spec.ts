import { expect, test } from "@playwright/test";

import { installFakeBackend } from "./tauri/bridge";

test.describe("出力デバイス", () => {
  test("このPCの出力デバイスが一覧に表示される", async ({ page }) => {
    await installFakeBackend(page, {
      outputDevices: [
        { id: "dev-realtek", name: "スピーカー (Realtek(R) Audio)" },
        { id: "dev-headset", name: "ヘッドセット (Bluetooth)" },
      ],
    });

    await page.goto("/");

    const section = page.getByRole("region", { name: "出力デバイス" });
    await expect(section.getByText("スピーカー (Realtek(R) Audio)")).toBeVisible();
    await expect(section.getByText("ヘッドセット (Bluetooth)")).toBeVisible();
  });

  test("デバイスを取得できないときは、その旨を表示する", async ({ page }) => {
    await installFakeBackend(page, { outputDevicesError: "CoCreateInstance failed" });

    await page.goto("/");

    await expect(page.getByRole("alert")).toContainText("CoCreateInstance failed");
  });
});
