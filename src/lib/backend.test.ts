import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vitest";

import { listOutputDevices } from "./backend";

describe("listOutputDevices", () => {
  afterEach(() => {
    clearMocks();
  });

  it("バックエンドの出力デバイス一覧をそのまま返す", async () => {
    mockIPC((cmd) => {
      if (cmd === "list_output_devices") {
        return [{ id: "{0.0.0.00000000}.dev-1", name: "スピーカー (Realtek)" }];
      }
    });

    await expect(listOutputDevices()).resolves.toEqual([
      { id: "{0.0.0.00000000}.dev-1", name: "スピーカー (Realtek)" },
    ]);
  });

  it("バックエンドが失敗したら、そのエラーを呼び出し元へ伝える", async () => {
    mockIPC(() => {
      throw "CoCreateInstance failed";
    });

    await expect(listOutputDevices()).rejects.toBe("CoCreateInstance failed");
  });
});
