import type { AudioSession, OutputDevice } from "../lib/backend";
import { useRoutingStore } from "../stores/routingStore";

interface SessionRowProps {
  session: AudioSession;
  devices: OutputDevice[];
}

// 音を出しているアプリ1つ。出力先を選ぶと、そのアプリの音を選んだデバイスへ向ける。
// 「既定のデバイス」を選ぶ（または元に戻す）と、向けた先を外す。
export function SessionRow({ session, devices }: SessionRowProps) {
  const routedDeviceId = useRoutingStore((state) => state.routes[session.pid]);
  const routeSession = useRoutingStore((state) => state.routeSession);
  const releaseSession = useRoutingStore((state) => state.releaseSession);
  const routedDevice = devices.find((device) => device.id === routedDeviceId);

  function handleChange(deviceId: string) {
    if (deviceId === "") {
      void releaseSession(session.pid);
    } else {
      void routeSession(session.pid, deviceId);
    }
  }

  return (
    <li className="devices__item session">
      <span>{session.exe_name}</span>{" "}
      <span className="devices__state">{session.playing ? "再生中" : "待機中"}</span>
      <div className="session__route">
        <select
          aria-label={`${session.exe_name} の出力先`}
          value={routedDeviceId ?? ""}
          onChange={(event) => handleChange(event.target.value)}
        >
          <option value="">既定のデバイス</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name}
            </option>
          ))}
        </select>
        {routedDevice && (
          <>
            <span className="session__destination">向け先: {routedDevice.name}</span>
            <button type="button" onClick={() => void releaseSession(session.pid)}>
              元に戻す
            </button>
          </>
        )}
      </div>
    </li>
  );
}
