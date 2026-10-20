import { useId, type DragEvent } from "react";

import type { App, Lane } from "../domain/routing";
import { useRoutingStore } from "../stores/routingStore";

interface AppCardProps {
  app: App;
  streamLanes: Lane[];
}

// アプリ1つのカード。ドラッグで配信先を変えられるほか、同じ操作を選択欄でもできる。
export function AppCard({ app, streamLanes }: AppCardProps) {
  const assignStreamLane = useRoutingStore((state) => state.assignStreamLane);
  const setStreamVolume = useRoutingStore((state) => state.setStreamVolume);
  const setMonitorEnabled = useRoutingStore((state) => state.setMonitorEnabled);
  const setMonitorVolume = useRoutingStore((state) => state.setMonitorVolume);
  const headingId = useId();
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

      <div className="app-card__row">
        <label htmlFor={selectId} className="app-card__label">
          配信
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
    </article>
  );
}
