// リリースビルドでは、起動時にコンソールウィンドウを出さない。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::list_output_devices])
        .run(tauri::generate_context!())
        .expect("Tauri アプリの起動に失敗しました");
}
