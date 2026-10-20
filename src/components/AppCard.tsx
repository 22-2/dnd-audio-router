import { useId, type DragEvent } from "react";

import type { App, Lane } from "../domain/routing";
import { useRoutingStore } from "../stores/routingStore";
import { PanControl } from "./PanControl";

interface AppCardProps {
  app: App;
  streamLanes: Lane[];
}

// アプリ1つのカード。ドラッグで配信先を変えられるほか、同じ操作を選択欄でもできる。
// 「配信」は外へ送る音、「自分」は自分の耳に届ける音で、それぞれ別に調整する。
export function AppCard({ app, streamLanes }: AppCardProps) {
  const assignStreamLane = useRoutingStore((state) => state.assignStreamLane);
  const setStreamVolume = useRoutingStore((state) => state.setStreamVolume);
  const setStreamPan = useRoutingStore((state) => state.setStreamPan);
  const setMonitorEnabled = useRoutingStore((state) => state.setMonitorEnabled);
  const setMonitorVolume = useRoutingStore((state) => state.setMonitorVolume);
  const setMonitorPan = useRoutingStore((state) => state.setMonitorPan);
  const headingId = useId();
  const streamHeadingId = useId();
  const monitorHeadingId = useId();
  const selectId = useId();

  function handleDragStart(event: DragEvent<HTMLElement>) {
    event.dataTransfer.setData("text/plain", app.id);
  }

  return (
    <article
      className="app-card"
      aria-labelledby={headingId}
      draggable
      onDragStart={handleDragStart}
    >
      <h3 id={headingId} className="app-card__name">
        {app.name}
      </h3>

      <section className="app-card__block" aria-labelledby={streamHeadingId}>
        <h4 id={streamHeadingId} className="app-card__block-title">
          配信
        </h4>

        <div className="app-card__row">
          <label htmlFor={selectId} className="app-card__label">
            送り先
          </label>
          <select
            id={selectId}
            value={app.stream.laneId ?? ""}
            onChange={(event) =>
              assignStreamLane(app.id, event.target.value === "" ? null : event.target.value)
            }
          >
            <option value="">なし</option>
            {streamLanes.map((lane) => (
              <option key={lane.id} value={lane.id}>
                {lane.name}
              </option>
            ))}
          </select>
        </div>

        <div className="app-card__row">
          <input
            type="range"
            min={0}
            max={100}
            value={app.stream.volume}
            aria-label="配信の音量"
            onChange={(event) => setStreamVolume(app.id, Number(event.target.value))}
          />
          <output className="app-card__value">{app.stream.volume}</output>
        </div>

        <PanControl
          label="配信の左右"
          value={app.stream.pan}
          onChange={(pan) => setStreamPan(app.id, pan)}
        />
      </section>

      <section className="app-card__block" aria-labelledby={monitorHeadingId}>
        <h4 id={monitorHeadingId} className="app-card__block-title">
          自分
        </h4>

        <div className="app-card__row">
          <label className="app-card__label">
            <input
              type="checkbox"
              checked={app.monitor.enabled}
              onChange={(event) => setMonitorEnabled(app.id, event.target.checked)}
            />
            聞く
          </label>
        </div>

        <div className="app-card__row">
          <input
            type="range"
            min={0}
            max={100}
            value={app.monitor.volume}
            aria-label="自分の音量"
            disabled={!app.monitor.enabled}
            onChange={(event) => setMonitorVolume(app.id, Number(event.target.value))}
          />
          <output className="app-card__value">{app.monitor.volume}</output>
        </div>

        <PanControl
          label="自分の左右"
          value={app.monitor.pan}
          disabled={!app.monitor.enabled}
          onChange={(pan) => setMonitorPan(app.id, pan)}
        />
      </section>
    </article>
  );
}
