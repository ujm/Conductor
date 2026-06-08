/** Prompt Library 型定義 */

export type VariableType = "file_path" | "string" | "number" | "select";

export interface PromptVariable {
  type: VariableType;
  label: string;
  default?: string;
  required: boolean;
  options?: string[];
}

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  tags: string[];
  template: string;
  variables: Record<string, PromptVariable>;
  created_at: string;
  updated_at: string;
}

export interface ResolvedPrompt {
  promptId: string;
  resolved: string;
  variables: Record<string, string>;
}
