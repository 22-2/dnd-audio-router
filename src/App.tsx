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

  const streamLanes = lanes.filter((lane) => lane.kind === "stream");
  const monitorLanes = lanes.filter((lane) => lane.kind === "monitor");

  return (
    <main className="app">
      <h1 className="app__title">音声ルーター</h1>

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
            />
          ))}
          {monitorLanes.map((lane) => (
            <LaneSection
              key={lane.id}
              lane={lane}
              routedApps={apps.filter((app) => app.monitor.enabled)}
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
