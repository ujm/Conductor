/** ナビゲーション状態ストア（アクティブビュー管理） */

import { create } from "zustand";
import type { ViewId } from "../types";

interface NavStore {
  activeView: ViewId;
  setView: (view: ViewId) => void;
}

export const useNavStore = create<NavStore>((set) => ({
  activeView: "pipeline",
  setView: (activeView) => set({ activeView }),
}));
