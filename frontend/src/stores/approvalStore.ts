/** 承認ゲート状態管理ストア */

import { create } from "zustand";
import type { ApprovalRequest } from "../types";

interface ApprovalStore {
  queue: ApprovalRequest[];
  setQueue: (queue: ApprovalRequest[]) => void;
}

export const useApprovalStore = create<ApprovalStore>((set) => ({
  queue: [],
  setQueue: (queue) => set({ queue }),
}));
