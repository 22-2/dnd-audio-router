import type { Page } from "@playwright/test";

// E2E 用の偽の Tauri ランタイム。
// 画面は Tauri の IPC（window.__TAURI_INTERNALS__.invoke）でバックエンドを呼ぶ。
// Rust も音声デバイスも使わずに済むよう、ページの読み込み前に同じ窓口を差し込む。
// ここで決めた値だけが返るので、テストは毎回同じ結果になる。
// 画面から届いた呼び出しは記録し、テストが読めるようにしておく。

export interface FakeOutputDevice {
  id: string;
  name: string;
}

export interface FakeAudioSession {
  pid: number;
  exe_name: string;
  playing: boolean;
}

export interface FakeBackendOptions {
  outputDevices?: FakeOutputDevice[];
  /** 指定すると、出力デバイスの取得がこのエラーで失敗する。 */
  outputDevicesError?: string;
  audioSessions?: FakeAudioSession[];
  /** 指定すると、出力先の変更がこのエラーで失敗する。 */
  routeError?: string;
}

export interface RecordedCall {
  cmd: string;
  args: Record<string, unknown>;
}

declare global {
  interface Window {
    __TAURI_CALLS__?: RecordedCall[];
  }
}

export async function installFakeBackend(
  page: Page,
  options: FakeBackendOptions = {},
): Promise<void> {
  await page.addInitScript(
    (fake) => {
      const calls: { cmd: string; args: Record<string, unknown> }[] = [];
      Object.defineProperty(window, "__TAURI_CALLS__", { value: calls });

      const internals = {
        invoke: async (cmd: string, args: Record<string, unknown> = {}) => {
          calls.push({ cmd, args });
          if (cmd === "list_output_devices") {
            if (fake.outputDevicesError) {
              throw fake.outputDevicesError;
            }
            return fake.outputDevices;
          }
          if (cmd === "list_audio_sessions") {
            return fake.audioSessions;
          }
          if (cmd === "route_app_to_device") {
            if (fake.routeError) {
              throw fake.routeError;
            }
            return null;
          }
          if (cmd === "release_app") {
            return null;
          }
          throw new Error(`未対応のコマンド: ${cmd}`);
        },
      };
      Object.defineProperty(window, "__TAURI_INTERNALS__", { value: internals });
    },
    {
      outputDevices: options.outputDevices ?? [],
      outputDevicesError: options.outputDevicesError ?? null,
      audioSessions: options.audioSessions ?? [],
      routeError: options.routeError ?? null,
    },
  );
}

/** 画面から送られた、指定のコマンドの呼び出しの引数を、送られた順に返す。 */
export async function invokedWith(page: Page, cmd: string): Promise<Record<string, unknown>[]> {
  return page.evaluate(
    (name) =>
      (window.__TAURI_CALLS__ ?? []).filter((call) => call.cmd === name).map((call) => call.args),
    cmd,
  );
}
