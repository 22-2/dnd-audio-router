// リリースビルドでは、起動時にコンソールウィンドウを出さない。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod commands;

use audio::routing::RoutedApps;
use tauri::{Manager, RunEvent};

fn main() {
    let app = tauri::Builder::default()
        .manage(RoutedApps::default())
        .invoke_handler(tauri::generate_handler![
            commands::list_output_devices,
            commands::list_audio_sessions,
            commands::route_app_to_device,
            commands::release_app,
        ])
        .build(tauri::generate_context!())
        .expect("Tauri アプリの起動に失敗しました");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            commands::release_all_routes(&handle.state::<RoutedApps>());
        }
    });
}
