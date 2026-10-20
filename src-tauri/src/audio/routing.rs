//! アプリの出力先を実デバイスに向ける。Windows のアプリごとの割り当てを使う。

use std::collections::HashMap;
use std::sync::Mutex;

/// Windows 自身の音を扱うプロセス。向けると、音声全体が止まるおそれがある。
const PROTECTED_EXES: [&str; 9] = [
    "system",
    "registry",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "services.exe",
    "lsass.exe",
    "winlogon.exe",
    "audiodg.exe",
];

/// 向けたアプリの記録。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RouteRecord {
    pub exe_name: String,
    pub device_id: String,
}

/// この起動中に向けたアプリの台帳。終了時に、ここにある分を必ず戻す。
#[derive(Default)]
pub struct RoutedApps(Mutex<HashMap<u32, RouteRecord>>);

impl RoutedApps {
    fn ledger(&self) -> std::sync::MutexGuard<'_, HashMap<u32, RouteRecord>> {
        // 台帳の更新は一瞬で終わり、途中で panic しない。毒化しても中身は正しいので、そのまま使う。
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn record(&self, pid: u32, exe_name: &str, device_id: &str) {
        self.ledger().insert(
            pid,
            RouteRecord {
                exe_name: exe_name.to_string(),
                device_id: device_id.to_string(),
            },
        );
    }

    pub fn forget(&self, pid: u32) -> Option<RouteRecord> {
        self.ledger().remove(&pid)
    }

    /// 台帳にある PID をすべて取り出し、台帳を空にする。
    pub fn take_all(&self) -> Vec<u32> {
        self.ledger().drain().map(|(pid, _)| pid).collect()
    }
}

/// このアプリの出力先を向けてはいけない理由。向けてよいなら `None`。
///
/// PID 0（システムの音）と PID 4（System）は、名前に関係なく保護する。
/// 名前が分からないプロセスも、保護対象かどうか判断できないので向けない。
pub fn refusal_for(pid: u32, exe_name: Option<&str>) -> Option<&'static str> {
    if pid == 0 || pid == 4 {
        return Some("Windows 自身のプロセス");
    }
    match exe_name {
        None => Some("実行ファイル名が分からないプロセス"),
        Some(name) if is_protected(name) => Some("Windows 自身のプロセス"),
        Some(_) => None,
    }
}

fn is_protected(exe_name: &str) -> bool {
    PROTECTED_EXES
        .iter()
        .any(|protected| exe_name.eq_ignore_ascii_case(protected))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn system_pids_are_refused_whatever_their_name() {
        assert!(refusal_for(0, Some("chrome.exe")).is_some());
        assert!(refusal_for(4, Some("chrome.exe")).is_some());
    }

    #[test]
    fn windows_own_processes_are_refused() {
        assert!(refusal_for(100, Some("csrss.exe")).is_some());
        assert!(refusal_for(101, Some("AUDIODG.EXE")).is_some());
    }

    #[test]
    fn a_process_whose_name_is_unknown_is_refused() {
        assert!(refusal_for(100, None).is_some());
    }

    #[test]
    fn an_ordinary_app_may_be_routed() {
        assert_eq!(refusal_for(49652, Some("PotPlayerMini64.exe")), None);
    }

    #[test]
    fn forgetting_a_route_returns_it_once() {
        let routes = RoutedApps::default();
        routes.record(49652, "PotPlayerMini64.exe", "{0.0.0.00000000}.cable");

        let forgotten = routes.forget(49652);

        assert_eq!(
            forgotten,
            Some(RouteRecord {
                exe_name: "PotPlayerMini64.exe".into(),
                device_id: "{0.0.0.00000000}.cable".into(),
            })
        );
        assert_eq!(routes.forget(49652), None);
    }

    #[test]
    fn take_all_empties_the_ledger() {
        let routes = RoutedApps::default();
        routes.record(1, "a.exe", "x");
        routes.record(2, "b.exe", "y");

        let mut pids = routes.take_all();
        pids.sort();

        assert_eq!(pids, vec![1, 2]);
        assert!(routes.take_all().is_empty());
    }
}
