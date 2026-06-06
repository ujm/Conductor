/** タスク状態管理ストア */

import { create } from "zustand";
import type { TaskConfig, TaskStatus } from "../types";

interface TaskStore {
  tasks: TaskConfig[];
  filterStatus: TaskStatus | "all";
  setTasks: (tasks: TaskConfig[]) => void;
  updateTask: (task: TaskConfig) => void;
  setFilterStatus: (status: TaskStatus | "all") => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  filterStatus: "all",
  setTasks: (tasks) => set({ tasks }),
  updateTask: (updated) =>
    set((store) => ({
      tasks: store.tasks.map((t) => (t.id === updated.id ? updated : t)),
    })),
  setFilterStatus: (filterStatus) => set({ filterStatus }),
}));
