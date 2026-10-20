import { create } from "zustand";

import {
  addStreamLane,
  assignStreamLane,
  createInitialState,
  setMonitorEnabled,
  setMonitorVolume,
  setStreamVolume,
  type RoutingState,
} from "../domain/routing";

interface RoutingActions {
  assignStreamLane: (appId: string, laneId: string | null) => void;
  setMonitorEnabled: (appId: string, enabled: boolean) => void;
  setStreamVolume: (appId: string, volume: number) => void;
  setMonitorVolume: (appId: string, volume: number) => void;
  addStreamLane: (name: string) => void;
}

// 画面が読む状態と、それを変える操作。中身の規則はすべて domain/routing にある。
export const useRoutingStore = create<RoutingState & RoutingActions>()((set) => ({
  ...createInitialState(),
  assignStreamLane: (appId, laneId) => set((state) => assignStreamLane(state, appId, laneId)),
  setMonitorEnabled: (appId, enabled) => set((state) => setMonitorEnabled(state, appId, enabled)),
  setStreamVolume: (appId, volume) => set((state) => setStreamVolume(state, appId, volume)),
  setMonitorVolume: (appId, volume) => set((state) => setMonitorVolume(state, appId, volume)),
  addStreamLane: (name) => set((state) => addStreamLane(state, name)),
}));
