//! アプリごとの出力先の割り当て（AudioPolicyConfig）への呼び出し。

use std::ffi::c_void;
use std::sync::OnceLock;

use windows::core::{GUID, HRESULT, HSTRING};

use crate::audio::{init_com, uninit_com};

/// エンドポイントIDの前に付く、デバイスインターフェースの接頭辞。
const MMDEVAPI_PREFIX: &str = "\\\\?\\SWD#MMDEVAPI#";
/// 再生デバイスのデバイスインターフェースの接尾辞。
const RENDER_SUFFIX: &str = "#{e6327cad-dcec-4949-ae8a-991e976a79d2}";
/// 実際のエンドポイントIDはこの長さよりずっと短い。大きすぎる値は COM に渡さない。
const MAX_DEVICE_ID_LEN: usize = 1024;

/// デバイスIDを割り当て用の形（デバイスインターフェースのシンボリックリンク）に包む。
pub fn wrap_device_id(device_id: &str) -> String {
    if device_id.starts_with(MMDEVAPI_PREFIX) {
        return device_id.to_string();
    }
    format!("{MMDEVAPI_PREFIX}{device_id}{RENDER_SUFFIX}")
}

/// 割り当て用の形から、普通のエンドポイントIDに戻す。
pub fn unwrap_device_id(device_id: &str) -> String {
    let without_prefix = device_id.strip_prefix(MMDEVAPI_PREFIX).unwrap_or(device_id);
    without_prefix
        .strip_suffix(RENDER_SUFFIX)
        .unwrap_or(without_prefix)
        .to_string()
}

/// 外から来たデバイスIDを、COM に渡す前に確かめる。
pub fn validate_device_id(device_id: &str) -> Result<(), String> {
    if device_id.is_empty() {
        return Err("デバイスIDが空です".to_string());
    }
    if device_id.len() > MAX_DEVICE_ID_LEN {
        return Err("デバイスIDが長すぎます".to_string());
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// 割り当ての読み書き（Windows の非公開API）
//
// Windows 11 の「アプリの音量とデバイスの基本設定」が使うのと同じ窓口。
// 活性化は AudioSes.dll の DllGetActivationFactory から行う。
// 活性化は MTA のスレッドで行わないと CLASS_E_CLASSNOTAVAILABLE になるので、
// 呼び出しは必ず on_com_thread を通す。
// ---------------------------------------------------------------------------

const AUDIO_POLICY_CONFIG_CLASS: &str = "Windows.Media.Internal.AudioPolicyConfig";

/// 既知の IAudioPolicyConfigFactory の IID。Windows のビルドごとに変わるため、
/// IInspectable::GetIids で実際の値を探し、既知のものがあればそれを使う。
const KNOWN_FACTORY_IIDS: [GUID; 3] = [
    GUID::from_u128(0xab3d4648_e242_459f_b02f_541c70306324), // Windows 11 21H2 以降
    GUID::from_u128(0x2a59116d_6c4f_45e0_a74f_707e3fef9258), // 旧版
    GUID::from_u128(0x32aa8e18_6496_4e24_9f94_b800e7eccc45), // 古い Windows 10
];

/// 再生（レンダー）側。
const E_RENDER: i32 = 0;
/// ERole: console / multimedia / communications。
const ROLES: [i32; 3] = [0, 1, 2];
/// 割り当てがないことを表す HRESULT（ERROR_NOT_FOUND）。
const HR_ERROR_NOT_FOUND: i32 = 0x80070490u32 as i32;

/// IAudioPolicyConfigFactory の仮想関数表の位置（IUnknown と IInspectable を含む0始まり）。
const SLOT_SET_PERSISTED_DEFAULT: usize = 25;
const SLOT_GET_PERSISTED_DEFAULT: usize = 26;

type SetPersistedDefaultFn = unsafe extern "system" fn(
    this: *mut c_void,
    process_id: u32,
    data_flow: i32,
    role: i32,
    device_id: isize,
) -> HRESULT;

type GetPersistedDefaultFn = unsafe extern "system" fn(
    this: *mut c_void,
    process_id: u32,
    data_flow: i32,
    role: i32,
    device_id: *mut HSTRING,
) -> HRESULT;

/// このアプリの再生先を、指定したデバイスに向ける（全ての役割）。
pub fn set_app_device(pid: u32, device_id: &str) -> Result<(), String> {
    validate_device_id(device_id)?;
    on_com_thread(|| {
        let policy = AudioPolicyConfig::activate()?;
        let wrapped = HSTRING::from(wrap_device_id(device_id));
        let mut ok = 0;
        let mut failure = None;
        for role in ROLES {
            let hr = policy.set_persisted_default(pid, E_RENDER, role, &wrapped);
            if hr.is_ok() {
                ok += 1;
            } else {
                failure = Some(hr);
            }
        }
        if let (0, Some(hr)) = (ok, failure) {
            return Err(format!("割り当てを書けません: 0x{:08X}", hr.0));
        }
        // 書けたように見えても、実際にそのデバイスへ向いたかを読み戻して確かめる。
        let applied = policy.get_persisted_default(pid, E_RENDER, ROLES[1])?;
        if applied.as_deref() != Some(device_id) {
            return Err("読み戻すと、指定したデバイスに向いていませんでした".to_string());
        }
        Ok(())
    })
}

/// このアプリの割り当てを外し、システムの既定のデバイスに戻す。
/// 割り当てがなければ何もしない。
pub fn clear_app_device(pid: u32) -> Result<(), String> {
    on_com_thread(|| {
        let policy = AudioPolicyConfig::activate()?;
        let mut failure = None;
        for role in ROLES {
            let hr = policy.clear_persisted_default(pid, E_RENDER, role);
            if hr.is_err() && hr.0 != HR_ERROR_NOT_FOUND {
                failure = Some(hr);
            }
        }
        match failure {
            Some(hr) => Err(format!("割り当てを外せません: 0x{:08X}", hr.0)),
            None => Ok(()),
        }
    })
}

/// COM を使える状態にして作業を行い、後始末もする。
fn on_com_thread<T>(work: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
    let com_owned = init_com()?;
    let result = work();
    uninit_com(com_owned);
    result
}

/// AudioSes.dll を、プロセスの終わりまで読み込んだままにする。
fn audio_ses_module() -> Result<isize, String> {
    static MODULE: OnceLock<isize> = OnceLock::new();
    if let Some(module) = MODULE.get() {
        return Ok(*module);
    }
    extern "system" {
        fn LoadLibraryW(name: *const u16) -> isize;
    }
    let name: Vec<u16> = "AudioSes.dll\0".encode_utf16().collect();
    // SAFETY: システムの DLL を読み込む。名前は NUL 終端。
    let module = unsafe { LoadLibraryW(name.as_ptr()) };
    if module == 0 {
        return Err("AudioSes.dll を読み込めません".to_string());
    }
    Ok(*MODULE.get_or_init(|| module))
}

/// HSTRING の内部のハンドル（透過的なラッパー）を取り出す。
fn hstring_handle(h: &HSTRING) -> isize {
    // SAFETY: HSTRING は生のハンドル1つを包むだけの透過的な型。
    unsafe { std::ptr::read(h as *const HSTRING as *const isize) }
}

/// COM オブジェクトの参照を1つ手放す（IUnknown::Release は仮想関数表の2番目）。
///
/// # Safety
/// `obj` は生きた COM オブジェクトで、呼び出し側がその参照を1つ持っていること。
unsafe fn release_com(obj: *mut c_void) {
    let vtable = *(obj as *const usize);
    let release: unsafe extern "system" fn(*mut c_void) -> u32 =
        std::mem::transmute(*((vtable + 2 * 8) as *const usize));
    release(obj);
}

/// 活性化した IAudioPolicyConfigFactory。Drop で参照を手放す。
struct AudioPolicyConfig {
    obj: *mut c_void,
    vtable: usize,
}

impl AudioPolicyConfig {
    fn activate() -> Result<Self, String> {
        extern "system" {
            fn GetProcAddress(module: isize, name: *const u8) -> isize;
        }
        type DllGetActivationFactoryFn =
            unsafe extern "system" fn(isize, *mut *mut c_void) -> HRESULT;

        let module = audio_ses_module()?;
        // SAFETY: 関数名は NUL 終端の定数。
        let proc_addr =
            unsafe { GetProcAddress(module, c"DllGetActivationFactory".as_ptr() as *const u8) };
        if proc_addr == 0 {
            return Err("AudioSes.dll に DllGetActivationFactory がありません".to_string());
        }
        // SAFETY: WinRT の活性化の規約どおりのシグネチャ。
        let dll_get_factory: DllGetActivationFactoryFn = unsafe { std::mem::transmute(proc_addr) };

        let class_name = HSTRING::from(AUDIO_POLICY_CONFIG_CLASS);
        let mut raw: *mut c_void = std::ptr::null_mut();
        // SAFETY: class_name は有効な HSTRING、raw は出力先。
        let hr = unsafe { dll_get_factory(hstring_handle(&class_name), &mut raw) };
        if hr.is_err() || raw.is_null() {
            return Err(format!(
                "DllGetActivationFactory が失敗しました: 0x{:08X}",
                hr.0
            ));
        }

        // SAFETY: raw は上で得た生きたオブジェクト。
        let vtable = unsafe { *(raw as *const usize) };
        let activated = discover_iid(raw, vtable).and_then(|iid| query_interface(raw, &iid));
        // 活性化の参照は QueryInterface で取り直したので、元の参照は手放す。
        // SAFETY: raw は今の関数が持つ参照。
        unsafe { release_com(raw) };
        activated
    }

    fn set_persisted_default(
        &self,
        pid: u32,
        data_flow: i32,
        role: i32,
        device_id: &HSTRING,
    ) -> HRESULT {
        // SAFETY: 仮想関数表の位置は上の定数どおり。引数はどれも呼び出しの間は生きている。
        let f: SetPersistedDefaultFn = unsafe {
            std::mem::transmute(*((self.vtable + SLOT_SET_PERSISTED_DEFAULT * 8) as *const usize))
        };
        // SAFETY: 生きたオブジェクトへの呼び出し。
        unsafe { f(self.obj, pid, data_flow, role, hstring_handle(device_id)) }
    }

    /// null の HSTRING を渡すと、割り当てを外して既定の動きに戻る。
    fn clear_persisted_default(&self, pid: u32, data_flow: i32, role: i32) -> HRESULT {
        // SAFETY: 仮想関数表の位置は上の定数どおり。
        let f: SetPersistedDefaultFn = unsafe {
            std::mem::transmute(*((self.vtable + SLOT_SET_PERSISTED_DEFAULT * 8) as *const usize))
        };
        // SAFETY: 生きたオブジェクトへの呼び出し。0 は割り当てを外す値。
        unsafe { f(self.obj, pid, data_flow, role, 0) }
    }

    fn get_persisted_default(
        &self,
        pid: u32,
        data_flow: i32,
        role: i32,
    ) -> Result<Option<String>, String> {
        // SAFETY: 仮想関数表の位置は上の定数どおり。
        let f: GetPersistedDefaultFn = unsafe {
            std::mem::transmute(*((self.vtable + SLOT_GET_PERSISTED_DEFAULT * 8) as *const usize))
        };
        let mut device_id = HSTRING::new();
        // SAFETY: 生きたオブジェクトへの呼び出し。出力の HSTRING はここで所有する。
        let hr = unsafe { f(self.obj, pid, data_flow, role, &mut device_id) };
        if hr.0 == HR_ERROR_NOT_FOUND {
            return Ok(None);
        }
        if hr.is_err() {
            return Err(format!("割り当てを読めません: 0x{:08X}", hr.0));
        }
        if device_id.is_empty() {
            return Ok(None);
        }
        Ok(Some(unwrap_device_id(&device_id.to_string_lossy())))
    }
}

impl Drop for AudioPolicyConfig {
    fn drop(&mut self) {
        // SAFETY: QueryInterface で取った参照を、このラッパーが1つだけ持っている。
        unsafe { release_com(self.obj) };
    }
}

/// 実行中のオブジェクトが公開している IID を調べ、知っているものを優先する。
fn discover_iid(raw: *mut c_void, vtable: usize) -> Result<GUID, String> {
    type GetIidsFn = unsafe extern "system" fn(*mut c_void, *mut u32, *mut *mut GUID) -> HRESULT;

    // SAFETY: GetIids は IInspectable の4番目（0始まり3）。
    let get_iids: GetIidsFn = unsafe { std::mem::transmute(*((vtable + 3 * 8) as *const usize)) };
    let mut count: u32 = 0;
    let mut iids: *mut GUID = std::ptr::null_mut();
    // SAFETY: 出力先は有効。返った配列は下で解放する。
    let hr = unsafe { get_iids(raw, &mut count, &mut iids) };
    let mut discovered = Vec::new();
    if hr.is_ok() && !iids.is_null() && count > 0 {
        // SAFETY: GetIids が count 個の GUID を返した。
        discovered.extend_from_slice(unsafe { std::slice::from_raw_parts(iids, count as usize) });
    }
    if !iids.is_null() {
        // SAFETY: GetIids が確保した配列を1回だけ解放する。
        unsafe {
            windows::Win32::System::Com::CoTaskMemFree(Some(iids as *const c_void));
        }
    }

    KNOWN_FACTORY_IIDS
        .iter()
        .find(|known| discovered.contains(known))
        .or(discovered.last())
        .copied()
        .ok_or_else(|| "IAudioPolicyConfigFactory の IID が見つかりません".to_string())
}

/// 活性化した工場を、見つけた IID のインターフェースとして取り直す。
fn query_interface(raw: *mut c_void, iid: &GUID) -> Result<AudioPolicyConfig, String> {
    type QueryInterfaceFn =
        unsafe extern "system" fn(*mut c_void, *const GUID, *mut *mut c_void) -> HRESULT;

    // SAFETY: raw は生きた COM オブジェクト。QueryInterface は IUnknown の1番目。
    let vtable = unsafe { *(raw as *const usize) };
    let qi: QueryInterfaceFn = unsafe { std::mem::transmute(*(vtable as *const usize)) };
    let mut obj: *mut c_void = std::ptr::null_mut();
    // SAFETY: iid と出力先は有効。
    let hr = unsafe { qi(raw, iid, &mut obj) };
    if hr.is_err() || obj.is_null() {
        return Err(format!("インターフェースを取得できません: 0x{:08X}", hr.0));
    }
    // SAFETY: 取れたばかりのオブジェクト。
    let vtable = unsafe { *(obj as *const usize) };
    Ok(AudioPolicyConfig { obj, vtable })
}

#[cfg(test)]
mod tests {
    use super::*;

    const ENDPOINT: &str = "{0.0.0.00000000}.{572be672-988f-41d0-94af-8e5da6d4e2fe}";

    #[test]
    fn wrapping_then_unwrapping_gives_the_endpoint_back() {
        let wrapped = wrap_device_id(ENDPOINT);

        assert_ne!(wrapped, ENDPOINT);
        assert_eq!(unwrap_device_id(&wrapped), ENDPOINT);
    }

    #[test]
    fn wrapping_twice_does_not_wrap_again() {
        let once = wrap_device_id(ENDPOINT);

        assert_eq!(wrap_device_id(&once), once);
    }

    #[test]
    fn a_blank_device_id_is_rejected() {
        assert!(validate_device_id("").is_err());
    }

    #[test]
    fn an_absurdly_long_device_id_is_rejected() {
        assert!(validate_device_id(&"x".repeat(4096)).is_err());
    }

    #[test]
    fn a_real_endpoint_id_is_accepted() {
        assert!(validate_device_id(ENDPOINT).is_ok());
    }

    /// 実機で、音を出しているアプリの出力先を向け、読み戻し、元に戻すまでを確かめる。
    ///
    /// 環境変数で対象を渡す: `AAR_TEST_PID`（音を出しているアプリのPID）と
    /// `AAR_TEST_DEVICE`（向け先のエンドポイントID）。
    /// 通常の `cargo test` では動かさず、`cargo test -- --ignored` で実行する。
    /// 読み戻しは、テストの中だけで使う（本番の経路は set_app_device が読み戻す）。
    fn current_app_device(pid: u32) -> Result<Option<String>, String> {
        on_com_thread(|| {
            AudioPolicyConfig::activate()?.get_persisted_default(pid, E_RENDER, ROLES[1])
        })
    }

    #[test]
    #[ignore]
    fn routing_a_running_app_round_trips_on_this_machine() {
        let pid: u32 = std::env::var("AAR_TEST_PID")
            .expect("AAR_TEST_PID を指定すること")
            .parse()
            .expect("AAR_TEST_PID は数字であること");
        let device = std::env::var("AAR_TEST_DEVICE").expect("AAR_TEST_DEVICE を指定すること");

        set_app_device(pid, &device).expect("出力先を向けられること");
        assert_eq!(
            current_app_device(pid).expect("向け先を読めること"),
            Some(device.clone())
        );

        clear_app_device(pid).expect("出力先を戻せること");
        assert_eq!(current_app_device(pid).expect("戻した後も読めること"), None);
    }
}
