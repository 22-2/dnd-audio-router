import { useEffect } from "react";

import { AppCard } from "./components/AppCard";
import { LaneSection } from "./components/LaneSection";
import { useRoutingStore } from "./stores/routingStore";
import "./App.css";

// 配信用レーンの名前は A, B, C と順に付ける。
function nextStreamLaneName(streamLaneCount: number): string {
  return `仮想デバイス${String.fromCharCode(65 + streamLaneCount)}`;
}

export function App() {
  const lanes = useRoutingStore((state) => state.lanes);
  const apps = useRoutingStore((state) => state.apps);
  const addStreamLane = useRoutingStore((state) => state.addStreamLane);
  const outputDevices = useRoutingStore((state) => state.outputDevices);
  const outputDevicesError = useRoutingStore((state) => state.outputDevicesError);
  const loadOutputDevices = useRoutingStore((state) => state.loadOutputDevices);
  const audioSessions = useRoutingStore((state) => state.audioSessions);
  const audioSessionsError = useRoutingStore((state) => state.audioSessionsError);
  const loadAudioSessions = useRoutingStore((state) => state.loadAudioSessions);

  useEffect(() => {
    void loadOutputDevices();
    void loadAudioSessions();
  }, [loadOutputDevices, loadAudioSessions]);

  const streamLanes = lanes.filter((lane) => lane.kind === "stream");
  const monitorLanes = lanes.filter((lane) => lane.kind === "monitor");

  return (
    <main className="app">
      <h1 className="app__title">音声ルーター</h1>

      <section className="app__section" aria-labelledby="sessions-heading">
        <h2 id="sessions-heading" className="app__heading">
          音を出しているアプリ
        </h2>
        {audioSessionsError ? (
          <p role="alert" className="app__error">
            アプリの一覧を取得できませんでした: {audioSessionsError}
          </p>
        ) : audioSessions.length === 0 ? (
          <p className="app__empty">音を出しているアプリはありません</p>
        ) : (
          <ul className="devices">
            {audioSessions.map((session) => (
              <li key={session.pid} className="devices__item">
                <span>{session.exe_name}</span>{" "}
                <span className="devices__state">{session.playing ? "再生中" : "待機中"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="app__section" aria-labelledby="devices-heading">
        <h2 id="devices-heading" className="app__heading">
          出力デバイス
        </h2>
        {outputDevicesError ? (
          <p role="alert" className="app__error">
            デバイスを取得できませんでした: {outputDevicesError}
          </p>
        ) : (
          <ul className="devices">
            {outputDevices.map((device) => (
              <li key={device.id} className="devices__item">
                {device.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="app__section" aria-labelledby="output-lanes-heading">
        <h2 id="output-lanes-heading" className="app__heading">
          出力レーン
        </h2>
        <div className="lanes">
          {streamLanes.map((lane) => (
            <LaneSection
              key={lane.id}
              lane={lane}
              routedApps={apps.filter((app) => app.stream.laneId === lane.id)}
              devices={outputDevices}
            />
          ))}
          {monitorLanes.map((lane) => (
            <LaneSection
              key={lane.id}
              lane={lane}
              routedApps={apps.filter((app) => app.monitor.enabled)}
              devices={outputDevices}
            />
          ))}
        </div>
        <button
          type="button"
          className="app__add-lane"
          onClick={() => addStreamLane(nextStreamLaneName(streamLanes.length))}
        >
          配信用レーンを追加
        </button>
      </section>

      <section className="app__section" aria-labelledby="apps-heading">
        <h2 id="apps-heading" className="app__heading">
          アプリ
        </h2>
        <div className="apps">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} streamLanes={streamLanes} />
          ))}
        </div>
      </section>
    </main>
  );
}
