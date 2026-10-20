import { expect, test } from "@playwright/test";

import { installFakeBackend } from "./tauri/bridge";

test.describe("音声ルーター", () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(page);
    await page.goto("/");
  });

  test("出力レーンとアプリが表示される", async ({ page }) => {
    for (const lane of ["仮想デバイスA", "仮想デバイスB", "Realtek"]) {
      await expect(page.getByRole("region", { name: lane })).toBeVisible();
    }
    for (const app of ["Discord", "PotPlayer", "Chrome"]) {
      await expect(page.getByRole("article", { name: app })).toBeVisible();
    }
  });

  test("アプリを配信用レーンへドラッグすると、そのレーンに並ぶ", async ({ page }) => {
    const discord = page.getByRole("article", { name: "Discord" });
    const laneA = page.getByRole("region", { name: "仮想デバイスA" });

    await discord.dragTo(laneA);

    await expect(laneA.getByText("Discord")).toBeVisible();
  });

  test("自分が聞くをオンにすると、チェックが入る", async ({ page }) => {
    const potplayer = page.getByRole("article", { name: "PotPlayer" });
    const listen = potplayer.getByRole("checkbox", { name: "聞く" });

    await listen.check();

    await expect(listen).toBeChecked();
  });

  test("配信の音量を変えると、表示の数値も変わる", async ({ page }) => {
    const discord = page.getByRole("article", { name: "Discord" });
    const volume = discord.getByRole("slider", { name: "配信の音量" });

    await volume.fill("70");

    await expect(volume).toHaveValue("70");
    await expect(discord.getByText("70", { exact: true })).toBeVisible();
  });

  test("配信用レーンを追加すると、新しいレーンが現れる", async ({ page }) => {
    await page.getByRole("button", { name: "配信用レーンを追加" }).click();

    await expect(page.getByRole("region", { name: "仮想デバイスC" })).toBeVisible();
  });

  test("配信の左右を変えると、表示が左右の文字に変わる", async ({ page }) => {
    const stream = page
      .getByRole("article", { name: "Discord" })
      .getByRole("region", { name: "配信" });
    await stream.getByText("左右").click();

    await stream.getByRole("slider", { name: "配信の左右" }).fill("-40");

    await expect(stream.getByText("左40")).toBeVisible();
  });

  test("自分の左右は、聞くをオンにするまで操作できない", async ({ page }) => {
    const potplayer = page.getByRole("article", { name: "PotPlayer" });
    const monitor = potplayer.getByRole("region", { name: "自分" });
    await monitor.getByText("左右").click();

    await expect(monitor.getByRole("slider", { name: "自分の左右" })).toBeDisabled();

    await potplayer.getByRole("checkbox", { name: "聞く" }).check();
    await monitor.getByRole("slider", { name: "自分の左右" }).fill("25");

    await expect(monitor.getByText("右25")).toBeVisible();
  });
});
