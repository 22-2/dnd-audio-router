import { create } from "zustand";

import { errorMessage, listOutputDevices, type OutputDevice } from "../lib/backend";
import {
  addStreamLane,
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
  assignStreamLane: (appId: string, laneId: string | null) => void;
  setMonitorEnabled: (appId: string, enabled: boolean) => void;
  setStreamVolume: (appId: string, volume: number) => void;
  setStreamPan: (appId: string, pan: number) => void;
  setMonitorVolume: (appId: string, volume: number) => void;
  setMonitorPan: (appId: string, pan: number) => void;
  addStreamLane: (name: string) => void;
}

// 画面が読む状態と、それを変える操作。中身の規則はすべて domain/routing にある。
interface DeviceState {
  outputDevices: OutputDevice[];
  /** 出力デバイスの取得に失敗したときの理由。取得できていれば null。 */
  outputDevicesError: string | null;
}

export const useRoutingStore = create<RoutingState & DeviceState & RoutingActions>()((set) => ({
  ...createInitialState(),
  outputDevices: [],
  outputDevicesError: null,
  loadOutputDevices: async () => {
    try {
      set({ outputDevices: await listOutputDevices(), outputDevicesError: null });
    } catch (error) {
      set({ outputDevicesError: errorMessage(error) });
    }
  },
  assignStreamLane: (appId, laneId) => set((state) => assignStreamLane(state, appId, laneId)),
  setMonitorEnabled: (appId, enabled) => set((state) => setMonitorEnabled(state, appId, enabled)),
  setStreamVolume: (appId, volume) => set((state) => setStreamVolume(state, appId, volume)),
  setStreamPan: (appId, pan) => set((state) => setStreamPan(state, appId, pan)),
  setMonitorVolume: (appId, volume) => set((state) => setMonitorVolume(state, appId, volume)),
  setMonitorPan: (appId, pan) => set((state) => setMonitorPan(state, appId, pan)),
  addStreamLane: (name) => set((state) => addStreamLane(state, name)),
}));
