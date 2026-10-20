//! 再生デバイス（レンダーエンドポイント）の一覧。Windows の Core Audio を使う。

use log::warn;
use windows::core::{GUID, PROPVARIANT, PWSTR};
use windows::Win32::Media::Audio::{
    eRender, IMMDevice, IMMDeviceCollection, IMMDeviceEnumerator, MMDeviceEnumerator,
    DEVICE_STATE_ACTIVE,
};
use windows::Win32::System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL, STGM_READ};
use windows::Win32::UI::Shell::PropertiesSystem::{IPropertyStore, PROPERTYKEY};

use crate::audio::{init_com, uninit_com, AudioDevice};

/// デバイスの表示名のキー（PKEY_Device_FriendlyName）。
const PKEY_DEVICE_FRIENDLY_NAME: PROPERTYKEY = PROPERTYKEY {
    fmtid: GUID::from_values(
        0xa45c254e,
        0xdf1c,
        0x4efd,
        [0x80, 0x20, 0x67, 0xd1, 0x46, 0xa8, 0x50, 0xe0],
    ),
    pid: 14,
};

/// VARIANT の型が「LPWSTR（文字列）」であることを表す値。
const VT_LPWSTR: u16 = 31;

/// このPCで有効な再生デバイスを全部返す。
///
/// 1台だけ開けなかったときは、そのデバイスを飛ばして残りを返す。
/// 全部取り逃すより、使える分だけ見せる方がよいため。
pub fn enumerate_render_devices() -> Result<Vec<AudioDevice>, String> {
    let com_owned = init_com()?;
    let result = list_active_render_devices();
    uninit_com(com_owned);
    result
}

fn list_active_render_devices() -> Result<Vec<AudioDevice>, String> {
    // SAFETY: MMDeviceEnumerator は IMMDeviceEnumerator の登録済みクラス。
    let enumerator: IMMDeviceEnumerator = unsafe {
        CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("デバイス列挙の準備に失敗しました: {e}"))?
    };

    // SAFETY: eRender と DEVICE_STATE_ACTIVE は有効な値。
    let collection: IMMDeviceCollection = unsafe {
        enumerator
            .EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
            .map_err(|e| format!("再生デバイスの一覧を取得できません: {e}"))?
    };

    // SAFETY: コレクションは上で作った有効なもの。
    let count = unsafe {
        collection
            .GetCount()
            .map_err(|e| format!("デバイス数を取得できません: {e}"))?
    };

    let mut devices = Vec::with_capacity(count as usize);
    for index in 0..count {
        // SAFETY: index は 0 以上 count 未満。
        let device = match unsafe { collection.Item(index) } {
            Ok(device) => device,
            Err(e) => {
                warn!("デバイス {index} を取得できません: {e}");
                continue;
            }
        };

        match device_info(&device) {
            Ok(device) => devices.push(device),
            Err(e) => warn!("デバイス {index} を読めません: {e}"),
        }
    }
    Ok(devices)
}

/// 1台のデバイスのIDと表示名を読む。
fn device_info(device: &IMMDevice) -> Result<AudioDevice, String> {
    // SAFETY: GetId が返す文字列は、使い終えたら CoTaskMemFree で解放する。
    let id_pwstr = unsafe {
        device
            .GetId()
            .map_err(|e| format!("デバイスIDを取得できません: {e}"))?
    };
    // SAFETY: COM から渡された NUL 終端の文字列。
    let id = unsafe { id_pwstr.to_string() }.unwrap_or_default();
    // SAFETY: GetId が確保したメモリを、ここで1回だけ解放する。
    unsafe { CoTaskMemFree(Some(id_pwstr.as_ptr() as *const _)) };

    // SAFETY: STGM_READ は有効な値。
    let props: IPropertyStore = unsafe {
        device
            .OpenPropertyStore(STGM_READ)
            .map_err(|e| format!("デバイスのプロパティを開けません ({id}): {e}"))?
    };

    // SAFETY: 表示名のキーは固定の有効な値。
    let friendly = unsafe {
        props
            .GetValue(&PKEY_DEVICE_FRIENDLY_NAME)
            .map_err(|e| format!("表示名を取得できません ({id}): {e}"))?
    };

    let name = friendly_name(&friendly, &id);
    Ok(AudioDevice { id, name })
}

/// 表示名の VARIANT から文字列を取り出す。文字列でなければ ID で代用する。
fn friendly_name(value: &PROPVARIANT, fallback: &str) -> String {
    let inner = value.as_raw();
    // SAFETY: 共用体の読み取り。直後に型（vt）を確かめてから使う。
    let vt = unsafe { inner.Anonymous.Anonymous.vt };
    if vt != VT_LPWSTR {
        return fallback.to_string();
    }
    // SAFETY: vt が VT_LPWSTR のときだけ、pwszVal は有効な文字列。
    let pwstr = unsafe { PWSTR(inner.Anonymous.Anonymous.Anonymous.pwszVal) };
    unsafe { pwstr.to_string() }.unwrap_or_else(|_| fallback.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_device_has_id_and_name() {
        let devices = enumerate_render_devices().expect("デバイス一覧を取得できること");

        for device in devices {
            assert!(!device.id.is_empty(), "IDが空: {}", device.name);
            assert!(!device.name.is_empty(), "名前が空: {}", device.id);
        }
    }
}
