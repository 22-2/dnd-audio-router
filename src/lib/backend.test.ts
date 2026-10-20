import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vitest";

import { listAudioSessions, listOutputDevices, releaseApp, routeAppToDevice } from "./backend";

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

describe("listAudioSessions", () => {
  afterEach(() => {
    clearMocks();
  });

  it("音声セッションを持つプロセスの一覧をそのまま返す", async () => {
    mockIPC((cmd) => {
      if (cmd === "list_audio_sessions") {
        return [{ pid: 49652, exe_name: "PotPlayerMini64.exe", playing: true }];
      }
    });

    await expect(listAudioSessions()).resolves.toEqual([
      { pid: 49652, exe_name: "PotPlayerMini64.exe", playing: true },
    ]);
  });
});

describe("routeAppToDevice と releaseApp", () => {
  afterEach(() => {
    clearMocks();
  });

  it("アプリのPIDと出力先のデバイスIDを渡して、向けるよう依頼する", async () => {
    const received: { cmd: string; args: unknown }[] = [];
    mockIPC((cmd, args) => {
      received.push({ cmd, args });
    });

    await routeAppToDevice(49652, "{0.0.0.00000000}.cable");

    expect(received).toEqual([
      { cmd: "route_app_to_device", args: { pid: 49652, deviceId: "{0.0.0.00000000}.cable" } },
    ]);
  });

  it("アプリのPIDを渡して、出力先の解除を依頼する", async () => {
    const received: { cmd: string; args: unknown }[] = [];
    mockIPC((cmd, args) => {
      received.push({ cmd, args });
    });

    await releaseApp(49652);

    expect(received).toEqual([{ cmd: "release_app", args: { pid: 49652 } }]);
  });
});
