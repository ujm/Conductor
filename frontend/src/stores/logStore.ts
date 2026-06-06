/** ログ状態管理ストア */

import { create } from "zustand";
import type { LogEntry } from "../types";

interface LogStore {
  entries: LogEntry[];
  filterAgentId: string | null;
  addEntry: (entry: LogEntry) => void;
  setEntries: (entries: LogEntry[]) => void;
  setFilterAgentId: (agentId: string | null) => void;
  clearEntries: () => void;
}

const MAX_LOG_ENTRIES = 2000;

export const useLogStore = create<LogStore>((set) => ({
  entries: [],
  filterAgentId: null,

  addEntry: (entry) =>
    set((store) => ({
      entries: [...store.entries.slice(-MAX_LOG_ENTRIES + 1), entry],
    })),

  setEntries: (entries) => set({ entries }),

  setFilterAgentId: (filterAgentId) => set({ filterAgentId }),

  clearEntries: () => set({ entries: [] }),
}));
