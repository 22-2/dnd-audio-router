import type { Page } from "@playwright/test";

// E2E 用の偽の Tauri ランタイム。
// 画面は Tauri の IPC（window.__TAURI_INTERNALS__.invoke）でバックエンドを呼ぶ。
// Rust も音声デバイスも使わずに済むよう、ページの読み込み前に同じ窓口を差し込む。
// ここで決めた値だけが返るので、テストは毎回同じ結果になる。

export interface FakeOutputDevice {
  id: string;
  name: string;
}

export interface FakeBackendOptions {
  outputDevices?: FakeOutputDevice[];
  /** 指定すると、出力デバイスの取得がこのエラーで失敗する。 */
  outputDevicesError?: string;
}

export async function installFakeBackend(
  page: Page,
  options: FakeBackendOptions = {},
): Promise<void> {
  await page.addInitScript(
    (fake) => {
      const internals = {
        invoke: async (cmd: string) => {
          if (cmd === "list_output_devices") {
            if (fake.outputDevicesError) {
              throw fake.outputDevicesError;
            }
            return fake.outputDevices;
          }
          throw new Error(`未対応のコマンド: ${cmd}`);
        },
      };
      Object.defineProperty(window, "__TAURI_INTERNALS__", { value: internals });
    },
    {
      outputDevices: options.outputDevices ?? [],
      outputDevicesError: options.outputDevicesError ?? null,
    },
  );
}
