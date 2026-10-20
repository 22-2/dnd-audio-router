//! フロントエンドから呼べるコマンド。

use crate::audio::devices::enumerate_render_devices;
use crate::audio::sessions::{enumerate_sessions, AudioSession};
use crate::audio::AudioDevice;

/// 画面の「出力デバイス」一覧に出す、このPCの再生デバイス。
///
/// COM はメインスレッドで扱うと取り扱いが難しいので、作業用のスレッドで動かす。
#[tauri::command]
pub async fn list_output_devices() -> Result<Vec<AudioDevice>, String> {
    tauri::async_runtime::spawn_blocking(enumerate_render_devices)
        .await
        .map_err(|e| e.to_string())?
}

/// 画面の「音を出しているアプリ」一覧に出す、音声セッションを持つプロセス。
#[tauri::command]
pub async fn list_audio_sessions() -> Result<Vec<AudioSession>, String> {
    tauri::async_runtime::spawn_blocking(enumerate_sessions)
        .await
        .map_err(|e| e.to_string())?
}
