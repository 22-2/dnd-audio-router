//! フロントエンドから呼べるコマンド。

use tauri::State;

use crate::audio::devices::enumerate_render_devices;
use crate::audio::policy::{clear_app_device, set_app_device};
use crate::audio::routing::{refusal_for, RoutedApps};
use crate::audio::sessions::{enumerate_sessions, process_names, AudioSession};
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

/// 指定したアプリの再生先を、指定したデバイスに向ける。
///
/// 実行ファイル名は、フロントから受け取らずにこちらで調べる。
/// 保護対象のプロセスと、一覧にない出力先は拒否する。
#[tauri::command]
pub async fn route_app_to_device(
    pid: u32,
    device_id: String,
    routes: State<'_, RoutedApps>,
) -> Result<(), String> {
    let (exe_name, device_id) = tauri::async_runtime::spawn_blocking(move || {
        let exe_name = process_names().remove(&pid);
        if let Some(reason) = refusal_for(pid, exe_name.as_deref()) {
            return Err(format!(
                "PID {pid} は{reason}なので、出力先を変えられません"
            ));
        }
        ensure_known_device(&device_id)?;
        set_app_device(pid, &device_id)?;
        // 保護の判定を通った時点で、実行ファイル名は分かっている。
        Ok((exe_name.unwrap_or_default(), device_id))
    })
    .await
    .map_err(|e| e.to_string())??;

    routes.record(pid, &exe_name, &device_id);
    Ok(())
}

/// 指定したアプリの出力先を、システムの既定に戻す。
#[tauri::command]
pub async fn release_app(pid: u32, routes: State<'_, RoutedApps>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || clear_app_device(pid))
        .await
        .map_err(|e| e.to_string())??;

    routes.forget(pid);
    Ok(())
}

/// 出力先として渡されたIDが、今このPCにある再生デバイスかを確かめる。
fn ensure_known_device(device_id: &str) -> Result<(), String> {
    let devices = enumerate_render_devices()?;
    if devices.iter().any(|device| device.id == device_id) {
        Ok(())
    } else {
        Err("指定された出力デバイスが見つかりません".to_string())
    }
}

/// アプリの終了時に、この起動中に向けたアプリを全部戻す。
///
/// 割り当ては Windows 側に残るので、戻さずに終わると、そのアプリは
/// 次に選ぶデバイスを無視し続ける。
pub fn release_all_routes(routes: &RoutedApps) {
    for pid in routes.take_all() {
        if let Err(e) = clear_app_device(pid) {
            log::warn!("PID {pid} の出力先を戻せませんでした: {e}");
        }
    }
}
