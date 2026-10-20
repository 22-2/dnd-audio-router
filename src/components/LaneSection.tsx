import { useId, type DragEvent } from "react";

import type { App, Lane } from "../domain/routing";
import { useRoutingStore } from "../stores/routingStore";

interface LaneSectionProps {
  lane: Lane;
  /** このレーンへ送られているアプリ（配信用は配信先、自分用は聞く設定のアプリ）。 */
  routedApps: App[];
}

const CAPTIONS: Record<Lane["kind"], string> = {
  stream: "配信用",
  monitor: "自分が聞く",
};

// 出力レーン1つ。配信用レーンはアプリをドロップで受け取る。
export function LaneSection({ lane, routedApps }: LaneSectionProps) {
  const assignStreamLane = useRoutingStore((state) => state.assignStreamLane);
  const headingId = useId();
  const isStream = lane.kind === "stream";

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (isStream) {
      event.preventDefault();
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    if (!isStream) {
      return;
    }
    event.preventDefault();
    assignStreamLane(event.dataTransfer.getData("text/plain"), lane.id);
  }

  return (
    <section
      className="lane"
      aria-labelledby={headingId}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <h3 id={headingId} className="lane__name">
        {lane.name}
      </h3>
      <p className="lane__caption">{CAPTIONS[lane.kind]}</p>
      <ul className="lane__apps">
        {routedApps.map((app) => (
          <li key={app.id} className="lane__app">
            {app.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
