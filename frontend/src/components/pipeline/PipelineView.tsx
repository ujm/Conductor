/**
 * PipelineView - パイプラインのメイン画面
 * ゴール入力 → 計画表示 → 承認 → 実行監視 の 4 フェーズで構成される
 */

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Play, Square, Plus, X, Sparkles, Check, RefreshCw, Loader2 } from "lucide-react";

import { AgentCard, type AgentNodeData } from "./AgentCard";
import { usePipelineStore } from "../../stores/pipelineStore";
import { useAgentStore } from "../../stores/agentStore";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { AgentConfig, OrchestratorPlan, PipelineConfig, PipelineNode, TriggerType } from "../../types";

const nodeTypes = { agentCard: AgentCard };

/** trigger 種別からエッジカラーを返す */
function triggerColor(trigger: TriggerType): string {
  const map: Record<TriggerType, string> = {
    done:     "#3dd68c",
    error:    "#f05c5c",
    approve:  "#a78bfa",
    parallel: "#4f8ef7",
  };
  return map[trigger];
}

/** PipelineConfig をReact Flowのノード・エッジに変換する */
function buildNodesAndEdges(
  nodes: PipelineNode[],
  onRun: (id: string) => void,
  onStop: (id: string) => void,
  onTaskChange: (id: string, task: string) => void,
  onDelete: (id: string) => void,
): { rfNodes: Node[]; rfEdges: Edge[] } {
  const rfNodes: Node[] = nodes.map((n, i) => ({
    id: n.id,
    type: "agentCard",
    position: { x: 60 + i * 280, y: 120 },
    data: { node: n, onRun, onStop, onTaskChange, onDelete } satisfies AgentNodeData,
  }));

  const rfEdges: Edge[] = [];
  for (const n of nodes) {
    for (const dep of n.depends_on ?? []) {
      // ノード ID またはエージェント名でソースを検索する（AI 生成計画はステップIDを使用）
      const sourceNode = nodes.find(
        (nd) => nd.id === dep.agent || nd.agent === dep.agent,
      );
      if (sourceNode) {
        rfEdges.push({
          id: `${sourceNode.id}-${n.id}`,
          source: sourceNode.id,
          target: n.id,
          label: dep.trigger,
          style: { stroke: triggerColor(dep.trigger), strokeWidth: 2 },
          labelStyle: { fill: triggerColor(dep.trigger), fontSize: 10 },
          animated: dep.trigger === "done",
        });
      }
    }
  }

  return { rfNodes, rfEdges };
}

// ─── エージェント追加モーダル ─────────────────────────────────────
function AddAgentModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (agent: AgentConfig) => Promise<void>;
}) {
  const agents = useAgentStore((s) => s.agents);
  const [adding, setAdding] = useState<string | null>(null);

  const handleSelect = async (agent: AgentConfig) => {
    setAdding(agent.id);
    try {
      await onAdd(agent);
      onClose();
    } finally {
      setAdding(null);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-lg w-80 border overflow-hidden"
        style={{ background: "#1a1e28", borderColor: "#2a3045" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "#2a3045" }}
        >
          <span className="text-sm font-semibold" style={{ color: "#e8ecf4", fontFamily: "'Syne', sans-serif" }}>
            エージェントを追加
          </span>
          <button onClick={onClose} style={{ color: "#9ba5bc" }}>
            <X size={14} />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {agents.length === 0 ? (
            <p className="text-xs px-4 py-6 text-center" style={{ color: "#9ba5bc" }}>
              登録済みエージェントがありません。
              <br />
              Agent Config 画面で登録してください。
            </p>
          ) : (
            agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => void handleSelect(agent)}
                disabled={adding === agent.id}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50"
                style={{ color: "#e8ecf4" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2a3045"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span className="text-lg">{agent.icon ?? "🤖"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{agent.name}</p>
                  <p className="text-xs" style={{ color: "#9ba5bc" }}>{agent.id}</p>
                </div>
                <span
                  className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: "#0d0f14", color: "#9ba5bc" }}
                >
                  {agent.type}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── フェーズ 1: ゴール入力 ──────────────────────────────────────
function GoalInputPhase({
  goal,
  onGoalChange,
  onSubmit,
}: {
  goal: string;
  onGoalChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
      <div className="text-center">
        <h2
          className="text-xl font-bold mb-2"
          style={{ color: "#e8ecf4", fontFamily: "'Syne', sans-serif" }}
        >
          何を達成したいですか？
        </h2>
        <p className="text-sm" style={{ color: "#9ba5bc" }}>
          ゴールを入力すると AI が実行計画を立案します
        </p>
      </div>

      <div className="w-full max-w-xl">
        <textarea
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && goal.trim()) {
              onSubmit();
            }
          }}
          placeholder="例: VPC の CloudFormation テンプレートを作成して、README に手順を記載してください"
          rows={4}
          className="w-full rounded-lg px-4 py-3 text-sm resize-none outline-none"
          style={{
            background: "#1a1e28",
            border: "1px solid #2a3045",
            color: "#e8ecf4",
            lineHeight: "1.6",
          }}
        />
        <p className="text-xs mt-1" style={{ color: "#4a5568" }}>
          Cmd+Enter で送信
        </p>
      </div>

      <button
        onClick={onSubmit}
        disabled={!goal.trim()}
        className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: "#4f8ef7", color: "#fff" }}
      >
        <Sparkles size={14} />
        計画を立案する
      </button>
    </div>
  );
}

// ─── フェーズ 2: 計画中 ──────────────────────────────────────────
function PlanningPhase({ goal }: { goal: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <Loader2
        size={36}
        className="animate-spin"
        style={{ color: "#4f8ef7" }}
      />
      <div className="text-center">
        <p
          className="text-sm font-semibold"
          style={{ color: "#e8ecf4", fontFamily: "'Syne', sans-serif" }}
        >
          計画を立案中...
        </p>
        <p
          className="text-xs mt-1 max-w-sm truncate"
          style={{ color: "#9ba5bc" }}
          title={goal}
        >
          {goal}
        </p>
      </div>
    </div>
  );
}

// ─── フェーズ 3: 承認待ち ────────────────────────────────────────
function ApprovalPhase({
  plan,
  onApprove,
  onReplan,
}: {
  plan: OrchestratorPlan;
  onApprove: () => void;
  onReplan: (feedback: string) => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  const handleReplan = () => {
    if (feedback.trim()) {
      onReplan(feedback.trim());
      setFeedback("");
      setShowFeedback(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ヘッダー */}
      <div
        className="px-6 py-4 border-b"
        style={{ borderColor: "#2a3045" }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-wider mb-1"
          style={{ color: "#4f8ef7" }}
        >
          AI 実行計画
        </p>
        <p className="text-sm" style={{ color: "#e8ecf4" }}>
          {plan.summary}
        </p>
      </div>

      {/* ステップ一覧 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-3 max-w-2xl">
          {plan.plan.map((step, i) => (
            <div
              key={step.id}
              className="rounded-lg border p-4"
              style={{ background: "#1a1e28", borderColor: "#2a3045" }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: "#2a3045", color: "#4f8ef7" }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{ background: "#0d0f14", color: "#9ba5bc" }}
                    >
                      {step.agent}
                    </span>
                    {step.depends_on.length > 0 && (
                      <span
                        className="text-xs"
                        style={{ color: "#4a5568" }}
                      >
                        ← {step.depends_on.join(", ")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: "#e8ecf4" }}>
                    {step.task}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* アクション */}
      <div
        className="px-6 py-4 border-t space-y-3"
        style={{ borderColor: "#2a3045", background: "#1a1e28" }}
      >
        {showFeedback ? (
          <div className="flex gap-2">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="修正の要望を入力してください..."
              rows={2}
              className="flex-1 rounded px-3 py-2 text-sm resize-none outline-none"
              style={{
                background: "#0d0f14",
                border: "1px solid #2a3045",
                color: "#e8ecf4",
              }}
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={handleReplan}
                disabled={!feedback.trim()}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-40"
                style={{ background: "#f5a623", color: "#fff" }}
              >
                <RefreshCw size={11} />
                再計画
              </button>
              <button
                onClick={() => { setShowFeedback(false); setFeedback(""); }}
                className="px-3 py-1.5 rounded text-xs"
                style={{ background: "#2a3045", color: "#9ba5bc" }}
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onApprove}
              className="flex items-center gap-2 px-5 py-2 rounded text-sm font-semibold"
              style={{ background: "#3dd68c", color: "#0d0f14" }}
            >
              <Check size={14} />
              承認して実行
            </button>
            <button
              onClick={() => setShowFeedback(true)}
              className="flex items-center gap-2 px-4 py-2 rounded text-sm"
              style={{ background: "#2a3045", color: "#9ba5bc" }}
            >
              <RefreshCw size={13} />
              修正を依頼
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── フェーズ 4: 実行監視（既存 React Flow） ──────────────────────
function ExecutingPhase({
  isDone,
  onNewGoal,
  showAddModal,
  setShowAddModal,
  anyRunning,
  pipeline,
  rfNodes,
  rfEdges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeDragStop,
  handleAddAgent,
}: {
  isDone: boolean;
  onNewGoal: () => void;
  showAddModal: boolean;
  setShowAddModal: (v: boolean) => void;
  anyRunning: boolean;
  pipeline: PipelineConfig;
  rfNodes: Node[];
  rfEdges: Edge[];
  onNodesChange: ReturnType<typeof useNodesState>[2];
  onEdgesChange: ReturnType<typeof useEdgesState>[2];
  onConnect: (c: Connection) => void;
  onNodeDragStop: () => void;
  handleAddAgent: (agent: AgentConfig) => Promise<void>;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* ツールバー */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "#2a3045", background: "#1a1e28" }}
      >
        <div className="flex items-center gap-3">
          <h2
            className="text-sm font-semibold"
            style={{ color: "#e8ecf4", fontFamily: "'Syne', sans-serif" }}
          >
            {pipeline.name}
          </h2>
          {isDone && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: "#3dd68c22", color: "#3dd68c" }}
            >
              完了
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {isDone && (
            <button
              onClick={onNewGoal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
              style={{ background: "#4f8ef722", color: "#4f8ef7", border: "1px solid #4f8ef744" }}
            >
              <Sparkles size={11} />
              新しいゴールを入力
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
            style={{ background: "#2a3045", color: "#9ba5bc", border: "1px solid #2a3045" }}
          >
            <Plus size={12} />
            エージェント追加
          </button>
          {!anyRunning ? (
            <button
              onClick={() => {
                fetch("/api/pipeline/run", { method: "POST" }).catch(console.error);
              }}
              disabled={pipeline.agents.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#4f8ef7", color: "#fff" }}
            >
              <Play size={12} />
              Run Pipeline
            </button>
          ) : (
            <button
              onClick={() => {
                fetch("/api/pipeline/stop", { method: "POST" }).catch(console.error);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
              style={{ background: "#f05c5c", color: "#fff" }}
            >
              <Square size={12} />
              Stop All
            </button>
          )}
        </div>
      </div>

      {/* React Flow キャンバス */}
      <div className="flex-1">
        {pipeline.agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: "#9ba5bc" }}>
            <p className="text-sm">パイプラインにエージェントがありません</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded text-sm"
              style={{ background: "#4f8ef7", color: "#fff" }}
            >
              <Plus size={14} />
              エージェントを追加
            </button>
          </div>
        ) : (
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            fitView
            style={{ background: "#0d0f14" }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2a3045" />
            <Controls style={{ background: "#1a1e28", border: "1px solid #2a3045" }} />
            <MiniMap
              style={{ background: "#1a1e28", border: "1px solid #2a3045" }}
              maskColor="rgba(13,15,20,0.7)"
              nodeColor="#4f8ef7"
            />
          </ReactFlow>
        )}
      </div>

      {showAddModal && (
        <AddAgentModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddAgent}
        />
      )}
    </div>
  );
}

// ─── メインビュー ─────────────────────────────────────────────────
export function PipelineView() {
  const { pipeline, goal, plan, goalState, setGoal, setGoalState, setPlan } =
    usePipelineStore();
  const runtimeStates = useAgentStore((s) => s.runtimeStates);
  const { send } = useWebSocket();
  const [showAddModal, setShowAddModal] = useState(false);

  // runtimeStates から実行中かどうかを導出する
  const anyRunning = Object.values(runtimeStates).some(
    (s) => s.status === "running" || s.status === "waiting" || s.status === "approval",
  );

  // 現在のパイプラインの全ノードが done になったら goalState を "done" に遷移する
  useEffect(() => {
    if (goalState !== "executing" || !pipeline) return;
    const nodeIds = pipeline.agents.map((n) => n.id);
    if (nodeIds.length === 0) return;
    const allFinished = nodeIds.every(
      (id) => runtimeStates[id]?.status === "done" || runtimeStates[id]?.status === "error",
    );
    if (allFinished) {
      setGoalState("done");
    }
  }, [runtimeStates, pipeline, goalState, setGoalState]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const handleRun = useCallback(
    (nodeId: string) => send("agent:run", { nodeId }),
    [send],
  );

  const handleStop = useCallback(
    (nodeId: string) => send("agent:stop", { nodeId }),
    [send],
  );

  const handleTaskChange = useCallback(
    async (nodeId: string, task: string) => {
      const current = usePipelineStore.getState().pipeline;
      if (!current) return;
      const updated = {
        ...current,
        agents: current.agents.map((n) => n.id === nodeId ? { ...n, task } : n),
      };
      try {
        const res = await fetch("/api/pipeline", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        if (res.ok) {
          usePipelineStore.getState().setPipeline(updated);
        }
      } catch (err) {
        console.error("タスク更新エラー:", err);
      }
    },
    [],
  );

  const handleDelete = useCallback(async (nodeId: string) => {
    try {
      await fetch(`/api/pipeline/agents/${nodeId}`, { method: "DELETE" });
      const current = usePipelineStore.getState().pipeline;
      if (current) {
        const updated = {
          ...current,
          agents: current.agents.filter((n) => n.id !== nodeId).map((n, i) => ({ ...n, order: i + 1 })),
        };
        usePipelineStore.getState().setPipeline(updated);
      }
    } catch (err) {
      console.error("ノード削除エラー:", err);
    }
  }, []);

  const handleAddAgent = useCallback(async (agent: AgentConfig) => {
    const res = await fetch("/api/pipeline/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: agent.id, task: "" }),
    });
    if (res.ok) {
      const updated = await res.json() as typeof pipeline;
      if (updated) usePipelineStore.getState().setPipeline(updated);
    }
  }, []);

  // パイプラインが更新されたら React Flow のノード・エッジを再構築する
  useEffect(() => {
    if (!pipeline) return;
    const { rfNodes: newNodes, rfEdges: newEdges } = buildNodesAndEdges(
      pipeline.agents,
      handleRun,
      handleStop,
      handleTaskChange,
      handleDelete,
    );
    setRfNodes(newNodes);
    setRfEdges(newEdges);
  }, [pipeline, handleRun, handleStop, handleTaskChange, handleDelete, setRfNodes, setRfEdges]);

  // ランタイム状態が変わったらノードデータを更新する
  useEffect(() => {
    setRfNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, _runtimeKey: runtimeStates[n.id]?.status },
      })),
    );
  }, [runtimeStates, setRfNodes]);

  const onConnect = useCallback(
    (connection: Connection) => setRfEdges((eds) => addEdge(connection, eds)),
    [setRfEdges],
  );

  const onNodeDragStop = useCallback(() => {
    if (!pipeline) return;
    const updated = {
      ...pipeline,
      agents: rfNodes
        .slice()
        .sort((a, b) => a.position.x - b.position.x)
        .map((n, i) => {
          const orig = pipeline.agents.find((ag) => ag.id === n.id);
          return orig ? { ...orig, order: i + 1 } : null;
        })
        .filter(Boolean) as typeof pipeline.agents,
    };
    send("pipeline:set", updated);
  }, [pipeline, rfNodes, send]);

  // ─── ゴール送信ハンドラー ──────────────────────────────────────
  const handleSubmitGoal = useCallback(() => {
    if (!goal.trim()) return;
    setGoalState("planning");  // 楽観的に UI を切り替える
    fetch("/api/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: goal.trim() }),
    }).catch(console.error);
  }, [goal, setGoalState]);

  const handleApprovePlan = useCallback(() => {
    setGoalState("executing");
    fetch("/api/orchestrate/approve", { method: "POST" }).catch(console.error);
  }, [setGoalState]);

  const handleReplan = useCallback(
    (feedback: string) => {
      setGoalState("planning");
      fetch("/api/orchestrate/replan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      }).catch(console.error);
    },
    [setGoalState],
  );

  const handleNewGoal = useCallback(() => {
    setPlan(null);
    setGoal("");
    setGoalState("idle");
  }, [setPlan, setGoal, setGoalState]);

  // ─── フェーズ分岐 ─────────────────────────────────────────────
  if (!pipeline) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "#9ba5bc" }}>
        <p className="text-sm">パイプラインを読み込み中...</p>
      </div>
    );
  }

  if (goalState === "idle") {
    return (
      <GoalInputPhase
        goal={goal}
        onGoalChange={setGoal}
        onSubmit={handleSubmitGoal}
      />
    );
  }

  if (goalState === "planning") {
    return <PlanningPhase goal={goal} />;
  }

  if (goalState === "awaiting_approval" && plan) {
    return (
      <ApprovalPhase
        plan={plan}
        onApprove={handleApprovePlan}
        onReplan={handleReplan}
      />
    );
  }

  // executing / done → 既存 React Flow ビュー
  return (
    <ExecutingPhase
      isDone={goalState === "done"}
      onNewGoal={handleNewGoal}
      showAddModal={showAddModal}
      setShowAddModal={setShowAddModal}
      anyRunning={anyRunning}
      pipeline={pipeline}
      rfNodes={rfNodes}
      rfEdges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeDragStop={onNodeDragStop}
      handleAddAgent={handleAddAgent}
    />
  );
}
