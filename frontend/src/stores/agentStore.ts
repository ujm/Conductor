/** エージェント状態管理ストア */

import { create } from "zustand";
import type { AgentConfig, AgentRuntimeState } from "../types";

interface AgentStore {
  agents: AgentConfig[];
  runtimeStates: Record<string, AgentRuntimeState>;
  setAgents: (agents: AgentConfig[]) => void;
  updateRuntimeState: (state: AgentRuntimeState) => void;
  appendOutput: (nodeId: string, chunk: string) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  runtimeStates: {},

  setAgents: (agents) => set({ agents }),

  updateRuntimeState: (incoming) =>
    set((store) => ({
      runtimeStates: {
        ...store.runtimeStates,
        [incoming.nodeId]: {
          ...store.runtimeStates[incoming.nodeId],
          ...incoming,
        },
      },
    })),

  appendOutput: (nodeId, chunk) =>
    set((store) => {
      const prev = store.runtimeStates[nodeId];
      if (!prev) return {};
      return {
        runtimeStates: {
          ...store.runtimeStates,
          [nodeId]: { ...prev, output: [...prev.output, chunk] },
        },
      };
    }),
}));
