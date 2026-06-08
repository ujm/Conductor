/** WebSocket 接続状態ストア */

import { create } from "zustand";

interface WsStore {
  isConnected: boolean;
  reconnectCount: number;
  setConnected: (connected: boolean) => void;
  incrementReconnect: () => void;
  resetReconnect: () => void;
}

export const useWsStore = create<WsStore>((set) => ({
  isConnected: false,
  reconnectCount: 0,
  setConnected: (isConnected) => set({ isConnected }),
  incrementReconnect: () => set((s) => ({ reconnectCount: s.reconnectCount + 1 })),
  resetReconnect: () => set({ reconnectCount: 0 }),
}));
