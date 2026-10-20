import { describe, expect, it } from "vitest";

import {
  addStreamLane,
  assignStreamLane,
  createInitialState,
  setMonitorEnabled,
  setMonitorPan,
  setMonitorVolume,
  setStreamPan,
  setStreamVolume,
} from "./routing";

describe("createInitialState", () => {
  it("配信用レーン2つと自分が聞くレーン1つを持つ", () => {
    const state = createInitialState();

    const streamLanes = state.lanes.filter((lane) => lane.kind === "stream");
    const monitorLanes = state.lanes.filter((lane) => lane.kind === "monitor");

    expect(streamLanes).toHaveLength(2);
    expect(monitorLanes).toHaveLength(1);
  });

  it("どのアプリも配信先が無く、自分用は聞かない状態で始まる", () => {
    const state = createInitialState();

    for (const app of state.apps) {
      expect(app.stream.laneId).toBeNull();
      expect(app.monitor.enabled).toBe(false);
    }
  });
});

describe("assignStreamLane", () => {
  it("アプリの配信先を配信用レーンに変える", () => {
    const state = createInitialState();
    const [streamLane] = state.lanes.filter((lane) => lane.kind === "stream");
    const app = state.apps[0];

    const next = assignStreamLane(state, app.id, streamLane.id);

    expect(next.apps[0].stream.laneId).toBe(streamLane.id);
  });

  it("nullを渡すと配信先を外す（なし）", () => {
    const state = createInitialState();
    const [streamLane] = state.lanes.filter((lane) => lane.kind === "stream");
    const app = state.apps[0];
    const routed = assignStreamLane(state, app.id, streamLane.id);

    const next = assignStreamLane(routed, app.id, null);

    expect(next.apps[0].stream.laneId).toBeNull();
  });

  it("自分が聞くレーンを配信先にすると拒否する", () => {
    const state = createInitialState();
    const monitorLane = state.lanes.find((lane) => lane.kind === "monitor");
    const app = state.apps[0];

    expect(() => assignStreamLane(state, app.id, monitorLane!.id)).toThrow();
  });

  it("元の状態を書き換えない", () => {
    const state = createInitialState();
    const [streamLane] = state.lanes.filter((lane) => lane.kind === "stream");
    const app = state.apps[0];

    assignStreamLane(state, app.id, streamLane.id);

    expect(state.apps[0].stream.laneId).toBeNull();
  });
});

describe("音量と左右", () => {
  it("配信の音量は0から100の範囲に収める", () => {
    const state = createInitialState();
    const app = state.apps[0];

    expect(setStreamVolume(state, app.id, 150).apps[0].stream.volume).toBe(100);
    expect(setStreamVolume(state, app.id, -5).apps[0].stream.volume).toBe(0);
    expect(setStreamVolume(state, app.id, 70).apps[0].stream.volume).toBe(70);
  });

  it("自分用の音量は0から100の範囲に収める", () => {
    const state = createInitialState();
    const app = state.apps[0];

    expect(setMonitorVolume(state, app.id, 120).apps[0].monitor.volume).toBe(100);
    expect(setMonitorVolume(state, app.id, -1).apps[0].monitor.volume).toBe(0);
  });

  it("左右は-100（左）から100（右）の範囲に収める", () => {
    const state = createInitialState();
    const app = state.apps[0];

    expect(setStreamPan(state, app.id, 300).apps[0].stream.pan).toBe(100);
    expect(setStreamPan(state, app.id, -300).apps[0].stream.pan).toBe(-100);
    expect(setMonitorPan(state, app.id, -40).apps[0].monitor.pan).toBe(-40);
  });
});

describe("setMonitorEnabled", () => {
  it("自分が聞くをオン・オフできる", () => {
    const state = createInitialState();
    const app = state.apps[0];

    const on = setMonitorEnabled(state, app.id, true);
    const off = setMonitorEnabled(on, app.id, false);

    expect(on.apps[0].monitor.enabled).toBe(true);
    expect(off.apps[0].monitor.enabled).toBe(false);
  });
});

describe("addStreamLane", () => {
  it("配信用レーンを1つ増やし、既存のレーンとは別のIDを付ける", () => {
    const state = createInitialState();

    const next = addStreamLane(state, "仮想デバイスC");

    const added = next.lanes.at(-1);
    expect(next.lanes).toHaveLength(state.lanes.length + 1);
    expect(added).toMatchObject({ name: "仮想デバイスC", kind: "stream" });
    expect(state.lanes.some((lane) => lane.id === added!.id)).toBe(false);
  });
});
