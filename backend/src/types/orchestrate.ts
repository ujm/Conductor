/** AI オーケストレーション関連の型定義 */

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

export type OrchestrationEvent =
  | { type: "planning"; goal: string }
  | { type: "plan_ready"; plan: OrchestratorPlan }
  | { type: "error"; message: string };

export interface DraftPlan {
  goal: string;
  plan: OrchestratorPlan;
  generated_at: string;
  status: "draft" | "confirmed";
}
