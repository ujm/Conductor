/** フロントエンド共通型定義 */

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
  depends_on?: Array<{
    agent: string;
    trigger: TriggerType;
  }>;
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
