import { expect, test } from "@playwright/test";

import { installFakeBackend, invokedWith } from "./tauri/bridge";

const DISCORD = { pid: 9604, exe_name: "Discord.exe", playing: false };
const POTPLAYER = { pid: 49652, exe_name: "PotPlayerMini64.exe", playing: true };
const CABLE = { id: "dev-cable", name: "CABLE Input (VB-Audio Virtual Cable)" };

test.describe("音を出しているアプリ", () => {
  test("音声セッションを持つアプリが一覧に出て、再生中かどうかが分かる", async ({ page }) => {
    await installFakeBackend(page, { audioSessions: [DISCORD, POTPLAYER] });

    await page.goto("/");

    const section = page.getByRole("region", { name: "音を出しているアプリ" });
    await expect(
      section.getByRole("listitem").filter({ hasText: "PotPlayerMini64.exe" }),
    ).toContainText("再生中");
    await expect(section.getByRole("listitem").filter({ hasText: "Discord.exe" })).toContainText(
      "待機中",
    );
  });

  test("音を出しているアプリがないときは、その旨を表示する", async ({ page }) => {
    await installFakeBackend(page, { audioSessions: [] });

    await page.goto("/");

    const section = page.getByRole("region", { name: "音を出しているアプリ" });
    await expect(section.getByText("音を出しているアプリはありません")).toBeVisible();
  });

  test("出力先を選ぶと、そのアプリを選んだデバイスへ向ける依頼が送られる", async ({ page }) => {
    await installFakeBackend(page, { audioSessions: [POTPLAYER], outputDevices: [CABLE] });
    await page.goto("/");

    const row = page.getByRole("listitem").filter({ hasText: "PotPlayerMini64.exe" });
    await row
      .getByRole("combobox", { name: "PotPlayerMini64.exe の出力先" })
      .selectOption(CABLE.id);

    await expect
      .poll(() => invokedWith(page, "route_app_to_device"))
      .toEqual([{ pid: POTPLAYER.pid, deviceId: CABLE.id }]);
    await expect(row.getByText("向け先: CABLE Input (VB-Audio Virtual Cable)")).toBeVisible();
  });

  test("元に戻すと、そのアプリの出力先を解除する依頼が送られ、選択も未選択に戻る", async ({
    page,
  }) => {
    await installFakeBackend(page, { audioSessions: [POTPLAYER], outputDevices: [CABLE] });
    await page.goto("/");

    const row = page.getByRole("listitem").filter({ hasText: "PotPlayerMini64.exe" });
    const destination = row.getByRole("combobox", { name: "PotPlayerMini64.exe の出力先" });
    await destination.selectOption(CABLE.id);
    await row.getByRole("button", { name: "元に戻す" }).click();

    await expect.poll(() => invokedWith(page, "release_app")).toEqual([{ pid: POTPLAYER.pid }]);
    await expect(destination).toHaveValue("");
  });

  test("出力先の変更に失敗したら、その理由を表示する", async ({ page }) => {
    await installFakeBackend(page, {
      audioSessions: [POTPLAYER],
      outputDevices: [CABLE],
      routeError: "読み戻すと、指定したデバイスに向いていませんでした",
    });
    await page.goto("/");

    const row = page.getByRole("listitem").filter({ hasText: "PotPlayerMini64.exe" });
    await row
      .getByRole("combobox", { name: "PotPlayerMini64.exe の出力先" })
      .selectOption(CABLE.id);

    await expect(page.getByRole("alert")).toContainText(
      "読み戻すと、指定したデバイスに向いていませんでした",
    );
  });
});
