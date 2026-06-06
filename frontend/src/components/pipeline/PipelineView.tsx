/**
 * PipelineView - パイプラインのメイン画面
 * React Flow を使いエージェントをノードとして表示・D&D で順序変更
 */

import { useCallback, useEffect } from "react";
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
import { Play, Square } from "lucide-react";

import { AgentCard, type AgentNodeData } from "./AgentCard";
import { usePipelineStore } from "../../stores/pipelineStore";
import { useAgentStore } from "../../stores/agentStore";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { PipelineNode, TriggerType } from "../../types";

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
): { rfNodes: Node[]; rfEdges: Edge[] } {
  const rfNodes: Node[] = nodes.map((n, i) => ({
    id: n.id,
    type: "agentCard",
    position: { x: 60 + i * 260, y: 120 },
    data: { node: n, onRun, onStop } satisfies AgentNodeData,
  }));

  const rfEdges: Edge[] = [];
  for (const n of nodes) {
    for (const dep of n.depends_on ?? []) {
      const sourceNode = nodes.find((nd) => nd.agent === dep.agent);
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

/** パイプラインのメイン画面 */
export function PipelineView() {
  const { pipeline, isRunning } = usePipelineStore();
  const runtimeStates = useAgentStore((s) => s.runtimeStates);
  const { send } = useWebSocket();

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

  // パイプラインが更新されたら React Flow のノード・エッジを再構築する
  useEffect(() => {
    if (!pipeline) return;
    const { rfNodes: newNodes, rfEdges: newEdges } = buildNodesAndEdges(
      pipeline.agents,
      handleRun,
      handleStop,
    );
    setRfNodes(newNodes);
    setRfEdges(newEdges);
  }, [pipeline, handleRun, handleStop, setRfNodes, setRfEdges]);

  // ランタイム状態が変わったらノードデータを更新する（再描画を最小化）
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

  // ドラッグ後に順序を更新してサーバーに送信する
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

  if (!pipeline) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "#9ba5bc" }}>
        <p className="text-sm">パイプラインを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ツールバー */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "#2a3045", background: "#1a1e28" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "#e8ecf4", fontFamily: "'Syne', sans-serif" }}>
          {pipeline.name}
        </h2>
        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={() => {
                fetch("/api/pipeline/run", { method: "POST" }).catch(console.error);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors"
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
      </div>
    </div>
  );
}
