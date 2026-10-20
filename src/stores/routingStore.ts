import { create } from "zustand";

import {
  errorMessage,
  listAudioSessions,
  listOutputDevices,
  type AudioSession,
  type OutputDevice,
} from "../lib/backend";
import {
  addStreamLane,
  assignLaneDevice,
  assignStreamLane,
  createInitialState,
  setMonitorEnabled,
  setMonitorVolume,
  setMonitorPan,
  setStreamPan,
  setStreamVolume,
  type RoutingState,
} from "../domain/routing";

interface RoutingActions {
  loadOutputDevices: () => Promise<void>;
  loadAudioSessions: () => Promise<void>;
  assignStreamLane: (appId: string, laneId: string | null) => void;
  setMonitorEnabled: (appId: string, enabled: boolean) => void;
  setStreamVolume: (appId: string, volume: number) => void;
  setStreamPan: (appId: string, pan: number) => void;
  setMonitorVolume: (appId: string, volume: number) => void;
  setMonitorPan: (appId: string, pan: number) => void;
  addStreamLane: (name: string) => void;
  assignLaneDevice: (laneId: string, deviceId: string | null) => void;
}

// 画面が読む状態と、それを変える操作。中身の規則はすべて domain/routing にある。
interface DeviceState {
  outputDevices: OutputDevice[];
  /** 出力デバイスの取得に失敗したときの理由。取得できていれば null。 */
  outputDevicesError: string | null;
  /** 音を出しているアプリの一覧。 */
  audioSessions: AudioSession[];
  audioSessionsError: string | null;
}

export const useRoutingStore = create<RoutingState & DeviceState & RoutingActions>()((set) => ({
  ...createInitialState(),
  outputDevices: [],
  outputDevicesError: null,
  audioSessions: [],
  audioSessionsError: null,
  loadOutputDevices: async () => {
    try {
      set({ outputDevices: await listOutputDevices(), outputDevicesError: null });
    } catch (error) {
      set({ outputDevicesError: errorMessage(error) });
    }
  },
  loadAudioSessions: async () => {
    try {
      set({ audioSessions: await listAudioSessions(), audioSessionsError: null });
    } catch (error) {
      set({ audioSessionsError: errorMessage(error) });
    }
  },
  assignStreamLane: (appId, laneId) => set((state) => assignStreamLane(state, appId, laneId)),
  setMonitorEnabled: (appId, enabled) => set((state) => setMonitorEnabled(state, appId, enabled)),
  setStreamVolume: (appId, volume) => set((state) => setStreamVolume(state, appId, volume)),
  setStreamPan: (appId, pan) => set((state) => setStreamPan(state, appId, pan)),
  setMonitorVolume: (appId, volume) => set((state) => setMonitorVolume(state, appId, volume)),
  setMonitorPan: (appId, pan) => set((state) => setMonitorPan(state, appId, pan)),
  addStreamLane: (name) => set((state) => addStreamLane(state, name)),
  assignLaneDevice: (laneId, deviceId) => set((state) => assignLaneDevice(state, laneId, deviceId)),
}));
