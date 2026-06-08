/** プロンプトテンプレート状態ストア */

import { create } from "zustand";
import type { PromptTemplate } from "../types";

interface PromptStore {
  templates: PromptTemplate[];
  setTemplates: (templates: PromptTemplate[]) => void;
  upsertTemplate: (template: PromptTemplate) => void;
  removeTemplate: (id: string) => void;
}

export const usePromptStore = create<PromptStore>((set) => ({
  templates: [],

  setTemplates: (templates) => set({ templates }),

  upsertTemplate: (template) =>
    set((store) => {
      const exists = store.templates.some((t) => t.id === template.id);
      const templates = exists
        ? store.templates.map((t) => (t.id === template.id ? template : t))
        : [...store.templates, template];
      return { templates };
    }),

  removeTemplate: (id) =>
    set((store) => ({ templates: store.templates.filter((t) => t.id !== id) })),
}));
