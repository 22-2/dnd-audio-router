//! Windows の音声（Core Audio）への入口。

pub mod devices;
pub mod sessions;

use serde::Serialize;
use windows::Win32::Foundation::RPC_E_CHANGED_MODE;
use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED};

/// 画面に出す出力デバイス1つ。`id` は Windows のエンドポイントID。
#[derive(Debug, Clone, Serialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
}

/// このスレッドで COM を使えるようにする。
///
/// 戻り値が `true` のときだけ、後で `uninit_com` で対になる解放が必要。
/// 既に別の形式で初期化済みなら、そのまま使えるので `false` を返す。
pub fn init_com() -> Result<bool, String> {
    // SAFETY: スレッドごとの COM 初期化。成功したときだけ、呼び出し側が解放する。
    let hr = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
    if hr.is_ok() {
        // S_OK と S_FALSE のどちらも、解放（CoUninitialize）と対になる。
        Ok(true)
    } else if hr == RPC_E_CHANGED_MODE {
        Ok(false)
    } else {
        Err(format!("COM の初期化に失敗しました: 0x{:08X}", hr.0))
    }
}

/// `init_com` が `true` を返したときに、対になる解放をする。
pub fn uninit_com(owned: bool) {
    if owned {
        // SAFETY: `init_com` が成功したときに限って呼ぶ。
        unsafe { CoUninitialize() };
    }
}
