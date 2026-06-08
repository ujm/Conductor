/** フロントエンド共通型定義 */

export type ViewId = "pipeline" | "tasks" | "files" | "logs" | "agents" | "approvals" | "prompts" | "settings";

export type AgentStatus =
  | "idle"
  | "running"
  | "waiting"
  | "paused"
  | "approval"
  | "done"
  | "error";

export type TriggerType = "done" | "error" | "approve" | "parallel";

export interface AgentRuntimeState {
  nodeId: string;
  agentId: string;
  status: AgentStatus;
  progress: number;
  currentTask?: string;
  retryCount: number;
  startedAt?: string;
  output: string[];
}

export interface PipelineNode {
  id: string;
  agent: string;
  order: number;
  task: string;
  instruction_files: string[];
  output_dir?: string;
  prompt_id?: string;
  prompt_variables?: Record<string, string>;
  position?: { x: number; y: number };
  depends_on?: Array<{
    agent: string;
    trigger: TriggerType;
  }>;
}

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

export interface PipelineConfig {
  version: number;
  name: string;
  agents: PipelineNode[];
}

export interface AgentConfig {
  id: string;
  name: string;
  type: "cli" | "rest_api" | "websocket";
  icon: string;
  color: string;
  connection?: {
    command?: string;
    args?: string[];
    cwd?: string;
    baseUrl?: string;
    env?: Record<string, string>;
  };
  defaults?: {
    timeout_minutes: number;
    retry_count: number;
    approval_required: boolean;
    context_files: string[];
  };
}

export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "blocked";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface TaskConfig {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_agent: string;
  created_at: string;
  updated_at: string;
  description: string;
  acceptance_criteria: string[];
  linked_files: string[];
}

export interface ApprovalRequest {
  id: string;
  agentId: string;
  pipelineNodeId: string;
  action: string;
  context: string;
  created_at: string;
  timeout_minutes?: number;
}

export interface LogEntry {
  timestamp: string;
  source: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  agentId?: string;
}

// ─── AI オーケストレーション ────────────────────────────────────

export interface PlanStep {
  id: string;
  agent: string;
  task: string;
  depends_on: string[];
}

export interface OrchestratorPlan {
  plan: PlanStep[];
  summary: string;
}

export type GoalState =
  | "idle"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "done";
