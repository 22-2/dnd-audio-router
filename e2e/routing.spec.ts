import { expect, test } from "@playwright/test";

test.describe("音声ルーター", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("出力レーンとアプリが表示される", async ({ page }) => {
    for (const lane of ["仮想デバイスA", "仮想デバイスB", "Realtek"]) {
      await expect(page.getByRole("region", { name: lane })).toBeVisible();
    }
    for (const app of ["Discord", "VLC", "Chrome"]) {
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
    const vlc = page.getByRole("article", { name: "VLC" });
    const listen = vlc.getByRole("checkbox", { name: "聞く" });

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
});
