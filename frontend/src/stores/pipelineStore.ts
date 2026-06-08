/** パイプライン状態管理ストア */

import { create } from "zustand";
import type { PipelineConfig, OrchestratorPlan, GoalState } from "../types";

interface PipelineStore {
  pipeline: PipelineConfig | null;
  isRunning: boolean;
  goal: string;
  plan: OrchestratorPlan | null;
  goalState: GoalState;
  setPipeline: (pipeline: PipelineConfig) => void;
  setIsRunning: (running: boolean) => void;
  setGoal: (goal: string) => void;
  setPlan: (plan: OrchestratorPlan | null) => void;
  setGoalState: (state: GoalState) => void;
}

export const usePipelineStore = create<PipelineStore>((set) => ({
  pipeline: null,
  isRunning: false,
  goal: "",
  plan: null,
  goalState: "idle",
  setPipeline: (pipeline) => set({ pipeline }),
  setIsRunning: (isRunning) => set({ isRunning }),
  setGoal: (goal) => set({ goal }),
  setPlan: (plan) => set({ plan }),
  setGoalState: (goalState) => set({ goalState }),
}));
