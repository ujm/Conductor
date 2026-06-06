/** パイプライン状態管理ストア */

import { create } from "zustand";
import type { PipelineConfig } from "../types";

interface PipelineStore {
  pipeline: PipelineConfig | null;
  isRunning: boolean;
  setPipeline: (pipeline: PipelineConfig) => void;
  setIsRunning: (running: boolean) => void;
}

export const usePipelineStore = create<PipelineStore>((set) => ({
  pipeline: null,
  isRunning: false,
  setPipeline: (pipeline) => set({ pipeline }),
  setIsRunning: (isRunning) => set({ isRunning }),
}));
