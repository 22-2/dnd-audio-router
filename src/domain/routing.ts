// アプリごとの音声ルーティングの状態と、その更新関数。
// すべて純粋関数で、受け取った状態を書き換えずに新しい状態を返す。
// Tauri や音声デバイスには依存しないので、単体テストだけで振る舞いを確かめられる。

export type LaneKind = "stream" | "monitor";

export interface Lane {
  id: string;
  name: string;
  /** stream は配信用（仮想デバイス）、monitor は自分が聞く出力（Realtek など）。 */
  kind: LaneKind;
  /** レーンが届ける先の実デバイスID。未選択なら null。 */
  deviceId: string | null;
}

/** 配信の送り先。laneId が null のときは配信しない（「なし」）。 */
export interface StreamChannel {
  laneId: string | null;
  volume: number;
  pan: number;
}

/** 自分が聞く設定。enabled が偽のときは音を流さない。 */
export interface MonitorChannel {
  enabled: boolean;
  volume: number;
  pan: number;
}

export interface App {
  id: string;
  name: string;
  stream: StreamChannel;
  monitor: MonitorChannel;
}

export interface RoutingState {
  lanes: Lane[];
  apps: App[];
}

const VOLUME_MIN = 0;
const VOLUME_MAX = 100;
const PAN_MIN = -100;
const PAN_MAX = 100;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function updateApp(state: RoutingState, appId: string, update: (app: App) => App): RoutingState {
  return {
    ...state,
    apps: state.apps.map((app) => (app.id === appId ? update(app) : app)),
  };
}

function findLane(state: RoutingState, laneId: string): Lane {
  const lane = state.lanes.find((candidate) => candidate.id === laneId);
  if (!lane) {
    throw new Error(`レーンが見つかりません: ${laneId}`);
  }
  return lane;
}

function assertStreamLane(lane: Lane): void {
  if (lane.kind !== "stream") {
    throw new Error(`配信先には配信用レーンを選んでください: ${lane.name}`);
  }
}

export function createInitialState(): RoutingState {
  return {
    lanes: [
      { id: "lane-virtual-a", name: "仮想デバイスA", kind: "stream", deviceId: null },
      { id: "lane-virtual-b", name: "仮想デバイスB", kind: "stream", deviceId: null },
      { id: "lane-realtek", name: "Realtek", kind: "monitor", deviceId: null },
    ],
    apps: [
      { id: "app-discord", name: "Discord", stream: emptyStream(), monitor: emptyMonitor() },
      { id: "app-vlc", name: "VLC", stream: emptyStream(), monitor: emptyMonitor() },
      { id: "app-chrome", name: "Chrome", stream: emptyStream(), monitor: emptyMonitor() },
    ],
  };
}

function emptyStream(): StreamChannel {
  return { laneId: null, volume: VOLUME_MAX, pan: 0 };
}

function emptyMonitor(): MonitorChannel {
  return { enabled: false, volume: VOLUME_MAX, pan: 0 };
}

/** アプリの配信先を変える。null を渡すと配信しない。 */
export function assignStreamLane(
  state: RoutingState,
  appId: string,
  laneId: string | null,
): RoutingState {
  if (laneId !== null) {
    assertStreamLane(findLane(state, laneId));
  }
  return updateApp(state, appId, (app) => ({ ...app, stream: { ...app.stream, laneId } }));
}

export function setStreamVolume(state: RoutingState, appId: string, volume: number): RoutingState {
  const clamped = clamp(volume, VOLUME_MIN, VOLUME_MAX);
  return updateApp(state, appId, (app) => ({ ...app, stream: { ...app.stream, volume: clamped } }));
}

export function setStreamPan(state: RoutingState, appId: string, pan: number): RoutingState {
  const clamped = clamp(pan, PAN_MIN, PAN_MAX);
  return updateApp(state, appId, (app) => ({ ...app, stream: { ...app.stream, pan: clamped } }));
}

export function setMonitorEnabled(
  state: RoutingState,
  appId: string,
  enabled: boolean,
): RoutingState {
  return updateApp(state, appId, (app) => ({ ...app, monitor: { ...app.monitor, enabled } }));
}

export function setMonitorVolume(state: RoutingState, appId: string, volume: number): RoutingState {
  const clamped = clamp(volume, VOLUME_MIN, VOLUME_MAX);
  return updateApp(state, appId, (app) => ({
    ...app,
    monitor: { ...app.monitor, volume: clamped },
  }));
}

export function setMonitorPan(state: RoutingState, appId: string, pan: number): RoutingState {
  const clamped = clamp(pan, PAN_MIN, PAN_MAX);
  return updateApp(state, appId, (app) => ({ ...app, monitor: { ...app.monitor, pan: clamped } }));
}

/** 配信用レーンを末尾に1つ足す。ID は既存と重ならない連番にする。 */
export function addStreamLane(state: RoutingState, name: string): RoutingState {
  const id = `lane-stream-${state.lanes.length + 1}`;
  return { ...state, lanes: [...state.lanes, { id, name, kind: "stream", deviceId: null }] };
}

/** レーンが届ける実デバイスを変える。null を渡すと未選択に戻す。 */
export function assignLaneDevice(
  state: RoutingState,
  laneId: string,
  deviceId: string | null,
): RoutingState {
  findLane(state, laneId);
  return {
    ...state,
    lanes: state.lanes.map((lane) => (lane.id === laneId ? { ...lane, deviceId } : lane)),
  };
}
