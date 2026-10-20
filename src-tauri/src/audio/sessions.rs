//! 音声セッションの列挙。音を出しているプロセスを一覧にする。

use std::collections::{BTreeMap, HashMap};

use log::warn;
use serde::Serialize;
use windows::core::Interface;
use windows::Win32::Foundation::CloseHandle;
use windows::Win32::Media::Audio::{
    eRender, AudioSessionStateActive, IAudioSessionControl2, IAudioSessionManager2, IMMDevice,
    IMMDeviceCollection, IMMDeviceEnumerator, MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};

use crate::audio::{init_com, uninit_com};

/// 画面に出す、音声セッションを持つプロセス1つ。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AudioSession {
    pub pid: u32,
    /// 実行ファイル名（例: PotPlayerMini64.exe）。分からないときは「PID 番号」。
    pub exe_name: String,
    /// いま音を出しているか。
    pub playing: bool,
}

/// 1台のデバイスで見つかった、1つのセッションの観測結果。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SessionObservation {
    pub pid: u32,
    pub playing: bool,
}

/// デバイスごとの観測を、プロセス単位の一覧にまとめる。
///
/// 同じプロセスが複数のデバイスにセッションを持つことがあるので、
/// 1プロセスにつき1件にし、どれか1つでも音が出ていれば「再生中」とする。
/// PID 0 はシステムの音なので除く。
pub fn merge_observations(
    observations: &[SessionObservation],
    exe_names: &HashMap<u32, String>,
) -> Vec<AudioSession> {
    let mut playing_by_pid: BTreeMap<u32, bool> = BTreeMap::new();
    for observation in observations.iter().filter(|o| o.pid != 0) {
        let playing = playing_by_pid.entry(observation.pid).or_insert(false);
        *playing |= observation.playing;
    }

    let mut sessions: Vec<AudioSession> = playing_by_pid
        .into_iter()
        .map(|(pid, playing)| AudioSession {
            pid,
            exe_name: exe_names
                .get(&pid)
                .cloned()
                .unwrap_or_else(|| format!("PID {pid}")),
            playing,
        })
        .collect();
    sessions.sort_by(|a, b| {
        a.exe_name
            .to_lowercase()
            .cmp(&b.exe_name.to_lowercase())
            .then(a.pid.cmp(&b.pid))
    });
    sessions
}

/// このPCの再生デバイスで音声セッションを持つプロセスを列挙する。
pub fn enumerate_sessions() -> Result<Vec<AudioSession>, String> {
    let com_owned = init_com()?;
    let result = collect_sessions();
    uninit_com(com_owned);
    result
}

fn collect_sessions() -> Result<Vec<AudioSession>, String> {
    // SAFETY: MMDeviceEnumerator は IMMDeviceEnumerator の登録済みクラス。
    let enumerator: IMMDeviceEnumerator = unsafe {
        CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("デバイス列挙の準備に失敗しました: {e}"))?
    };
    // SAFETY: eRender と DEVICE_STATE_ACTIVE は有効な値。
    let devices: IMMDeviceCollection = unsafe {
        enumerator
            .EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
            .map_err(|e| format!("再生デバイスの一覧を取得できません: {e}"))?
    };
    // SAFETY: コレクションは上で作った有効なもの。
    let count = unsafe {
        devices
            .GetCount()
            .map_err(|e| format!("デバイス数を取得できません: {e}"))?
    };

    let mut observations = Vec::new();
    for index in 0..count {
        // SAFETY: index は 0 以上 count 未満。
        let device = match unsafe { devices.Item(index) } {
            Ok(device) => device,
            Err(e) => {
                warn!("デバイス {index} を取得できません: {e}");
                continue;
            }
        };
        // 1台のデバイスが読めなくても、他のデバイスのセッションは残す。
        match device_observations(&device) {
            Ok(found) => observations.extend(found),
            Err(e) => warn!("デバイス {index} のセッションを読めません: {e}"),
        }
    }

    Ok(merge_observations(&observations, &process_names()))
}

/// 1台のデバイスにある、すべてのセッションを観測する。
fn device_observations(device: &IMMDevice) -> Result<Vec<SessionObservation>, String> {
    // SAFETY: アクティブな再生デバイスからセッションマネージャーを得る。
    let manager: IAudioSessionManager2 = unsafe {
        device
            .Activate::<IAudioSessionManager2>(CLSCTX_ALL, None)
            .map_err(|e| format!("セッションマネージャーを開けません: {e}"))?
    };
    // SAFETY: 有効なセッションマネージャーから列挙子を得る。
    let sessions = unsafe {
        manager
            .GetSessionEnumerator()
            .map_err(|e| format!("セッションの一覧を取得できません: {e}"))?
    };
    // SAFETY: 列挙子は上で作った有効なもの。
    let count = unsafe {
        sessions
            .GetCount()
            .map_err(|e| format!("セッション数を取得できません: {e}"))?
    };

    let mut found = Vec::new();
    for index in 0..count {
        // SAFETY: index は 0 以上 count 未満。
        let Ok(control) = (unsafe { sessions.GetSession(index) }) else {
            warn!("セッション {index} を取得できません");
            continue;
        };
        let Ok(control2) = control.cast::<IAudioSessionControl2>() else {
            continue;
        };
        // SAFETY: 生きているセッションの PID を読む。
        let Ok(pid) = (unsafe { control2.GetProcessId() }) else {
            continue;
        };
        // SAFETY: 生きているセッションの状態を読む。
        let Ok(state) = (unsafe { control.GetState() }) else {
            continue;
        };
        found.push(SessionObservation {
            pid,
            playing: state == AudioSessionStateActive,
        });
    }
    Ok(found)
}

/// 起動中の全プロセスについて、PID から実行ファイル名への対応を作る。
fn process_names() -> HashMap<u32, String> {
    let mut names = HashMap::new();
    // SAFETY: プロセスの一覧のスナップショットを作る。下で必ず閉じる。
    let snapshot = match unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) } {
        Ok(handle) => handle,
        Err(e) => {
            warn!("プロセスの一覧を取得できません: {e}");
            return names;
        }
    };

    let mut entry = PROCESSENTRY32W {
        dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    // SAFETY: entry は dwSize を設定済み。snapshot は上で作った有効なハンドル。
    if unsafe { Process32FirstW(snapshot, &mut entry) }.is_ok() {
        loop {
            names.insert(entry.th32ProcessID, exe_name_of(&entry));
            // SAFETY: 同じスナップショットと entry を使い続ける。
            if unsafe { Process32NextW(snapshot, &mut entry) }.is_err() {
                break;
            }
        }
    }

    // SAFETY: CreateToolhelp32Snapshot で作ったハンドルを1回だけ閉じる。
    let _ = unsafe { CloseHandle(snapshot) };
    names
}

/// PROCESSENTRY32W の実行ファイル名（NUL で終わる UTF-16）を文字列にする。
fn exe_name_of(entry: &PROCESSENTRY32W) -> String {
    let len = entry
        .szExeFile
        .iter()
        .position(|&c| c == 0)
        .unwrap_or(entry.szExeFile.len());
    String::from_utf16_lossy(&entry.szExeFile[..len])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(entries: &[(u32, &str)]) -> HashMap<u32, String> {
        entries
            .iter()
            .map(|(pid, name)| (*pid, name.to_string()))
            .collect()
    }

    #[test]
    fn one_process_on_two_devices_is_listed_once() {
        let observations = [
            SessionObservation {
                pid: 10,
                playing: false,
            },
            SessionObservation {
                pid: 10,
                playing: true,
            },
        ];

        let sessions = merge_observations(&observations, &names(&[(10, "Discord.exe")]));

        assert_eq!(
            sessions,
            vec![AudioSession {
                pid: 10,
                exe_name: "Discord.exe".into(),
                playing: true
            }]
        );
    }

    #[test]
    fn system_sounds_with_pid_zero_are_left_out() {
        let observations = [SessionObservation {
            pid: 0,
            playing: true,
        }];

        assert!(merge_observations(&observations, &HashMap::new()).is_empty());
    }

    #[test]
    fn unknown_process_is_named_by_its_pid() {
        let observations = [SessionObservation {
            pid: 4242,
            playing: false,
        }];

        let sessions = merge_observations(&observations, &HashMap::new());

        assert_eq!(sessions[0].exe_name, "PID 4242");
    }

    #[test]
    fn sessions_are_sorted_by_executable_name() {
        let observations = [
            SessionObservation {
                pid: 1,
                playing: false,
            },
            SessionObservation {
                pid: 2,
                playing: false,
            },
        ];

        let sessions = merge_observations(
            &observations,
            &names(&[(1, "PotPlayerMini64.exe"), (2, "Discord.exe")]),
        );

        let order: Vec<&str> = sessions.iter().map(|s| s.exe_name.as_str()).collect();
        assert_eq!(order, vec!["Discord.exe", "PotPlayerMini64.exe"]);
    }
}
