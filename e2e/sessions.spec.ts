import { expect, test } from "@playwright/test";

import { installFakeBackend } from "./tauri/bridge";

test.describe("音を出しているアプリ", () => {
  test("音声セッションを持つアプリが一覧に出て、再生中かどうかが分かる", async ({ page }) => {
    await installFakeBackend(page, {
      audioSessions: [
        { pid: 9604, exe_name: "Discord.exe", playing: false },
        { pid: 49652, exe_name: "PotPlayerMini64.exe", playing: true },
      ],
    });

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
});
