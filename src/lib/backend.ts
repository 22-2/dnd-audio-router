import { invoke } from "@tauri-apps/api/core";

/** このPCの出力先（Windows の再生デバイス）。id は Windows のエンドポイントID。 */
export interface OutputDevice {
  id: string;
  name: string;
}

/** Rust 側の list_output_devices を呼ぶ。失敗したら Rust のエラーがそのまま伝わる。 */
export function listOutputDevices(): Promise<OutputDevice[]> {
  return invoke<OutputDevice[]>("list_output_devices");
}

/** 音声セッションを持つプロセス1つ。Rust 側の構造体と同じ形（snake_case）で届く。 */
export interface AudioSession {
  pid: number;
  exe_name: string;
  playing: boolean;
}

/** Rust 側の list_audio_sessions を呼ぶ。音を出しているアプリの一覧になる。 */
export function listAudioSessions(): Promise<AudioSession[]> {
  return invoke<AudioSession[]>("list_audio_sessions");
}

/** Tauri のエラーは文字列で届くことが多いので、どちらの形でも文字にする。 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
