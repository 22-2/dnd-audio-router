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

  test("出力レーンの接続先に実デバイスを選ぶと、その選択がレーンに反映される", async ({ page }) => {
    await installFakeBackend(page, {
      outputDevices: [
        { id: "dev-cable", name: "CABLE Input (VB-Audio Virtual Cable)" },
        { id: "dev-realtek", name: "スピーカー (Realtek(R) Audio)" },
      ],
    });
    await page.goto("/");

    const laneA = page.getByRole("region", { name: "仮想デバイスA" });
    const destination = laneA.getByRole("combobox", { name: "接続先" });
    await destination.selectOption({ label: "CABLE Input (VB-Audio Virtual Cable)" });

    await expect(destination).toHaveValue("dev-cable");
  });

  test("デバイスを取得できないときは、その旨を表示する", async ({ page }) => {
    await installFakeBackend(page, { outputDevicesError: "CoCreateInstance failed" });

    await page.goto("/");

    await expect(page.getByRole("alert")).toContainText("CoCreateInstance failed");
  });
});
