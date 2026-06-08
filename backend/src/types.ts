/**
 * Conductor バックエンド共通型定義
 */

/** エージェントの実行状態 */
export type AgentStatus =
  | "idle"
  | "running"
  | "waiting"
  | "paused"
  | "approval"
  | "done"
  | "error";

/** パイプライン依存関係のトリガー種別 */
export type TriggerType = "done" | "error" | "approve" | "parallel";

/** エージェント接続方式 */
export type AgentConnectionType = "cli" | "rest_api" | "websocket";

/** エージェント設定（YAMLから読み込む） */
export interface AgentConfig {
  id: string;
  name: string;
  type: AgentConnectionType;
  icon: string;
  color: string;
  connection: {
    command?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    baseUrl?: string;
    apiKey?: string;
  };
  defaults: {
    timeout_minutes: number;
    retry_count: number;
    approval_required: boolean;
    context_files: string[];
  };
}

/** パイプラインのエージェントノード */
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

/** パイプライン定義（YAMLから読み込む） */
export interface PipelineConfig {
  version: number;
  name: string;
  agents: PipelineNode[];
}

/** プロジェクト設定 */
export interface ProjectConfig {
  name: string;
  root: string;
  created_at: string;
}

/** タスク状態 */
export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "blocked";

/** タスク優先度 */
export type TaskPriority = "low" | "medium" | "high" | "critical";

/** タスク定義 */
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

/** エージェント実行結果 */
export interface AgentResult {
  agentId: string;
  exitCode: number;
  output: string;
  duration_ms: number;
  completed_at: string;
}

/** 承認待ちアクション */
export interface ApprovalRequest {
  id: string;
  agentId: string;
  pipelineNodeId: string;
  action: string;
  context: string;
  created_at: string;
  timeout_minutes?: number;
}

/** ログエントリ */
export interface LogEntry {
  timestamp: string;
  source: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  agentId?: string;
}

/** REST APIの統一エラーレスポンス */
export interface ApiError {
  error: string;
  code: string;
}

/** エージェントの実行時状態（メモリ上） */
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
