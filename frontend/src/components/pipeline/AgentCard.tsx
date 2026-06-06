/**
 * AgentCard - パイプライン上のエージェントノードコンポーネント
 * React Flow の custom node として使用する
 */

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Play, Square, RefreshCw } from "lucide-react";
import { StatusBadge } from "../common/StatusBadge";
import { useAgentStore } from "../../stores/agentStore";
import type { PipelineNode } from "../../types";

export interface AgentNodeData {
  node: PipelineNode;
  onRun?: (nodeId: string) => void;
  onStop?: (nodeId: string) => void;
  [key: string]: unknown;
}

/** パイプライン上のエージェントカードノード */
export function AgentCard({ data }: NodeProps) {
  const nodeData = data as AgentNodeData;
  const { node, onRun, onStop } = nodeData;
  const runtimeState = useAgentStore((s) => s.runtimeStates[node.id]);
  const status = runtimeState?.status ?? "idle";
  const progress = runtimeState?.progress ?? 0;

  const isRunning = status === "running";

  return (
    <div
      className="relative min-w-[200px] rounded-lg border transition-all duration-150 cursor-default select-none"
      style={{
        background: "#1a1e28",
        borderColor: isRunning ? "#3dd68c" : "#2a3045",
        boxShadow: isRunning ? "0 0 12px rgba(61, 214, 140, 0.2)" : "none",
      }}
    >
      {/* 上側のハンドル（依存を受け取る側） */}
      <Handle type="target" position={Position.Left} style={{ background: "#2a3045", border: "2px solid #4f8ef7" }} />

      <div className="p-3">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-sm font-semibold truncate max-w-[130px]"
            style={{ fontFamily: "'Syne', sans-serif", color: "#e8ecf4" }}
            title={node.agent}
          >
            {node.agent}
          </span>
          <StatusBadge status={status} />
        </div>

        {/* タスク説明 */}
        <p
          className="text-xs mb-3 line-clamp-2"
          style={{ color: "#9ba5bc" }}
          title={node.task}
        >
          {node.task || "タスク未設定"}
        </p>

        {/* プログレスバー（running の時のみ表示） */}
        {isRunning && (
          <div className="h-1 rounded-full mb-3 overflow-hidden" style={{ background: "#2a3045" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: "#3dd68c" }}
            />
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex gap-1.5">
          {!isRunning ? (
            <button
              onClick={() => onRun?.(node.id)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
              style={{ background: "#4f8ef7", color: "#fff" }}
              title="実行"
            >
              <Play size={10} />
              Run
            </button>
          ) : (
            <button
              onClick={() => onStop?.(node.id)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
              style={{ background: "#f05c5c", color: "#fff" }}
              title="停止"
            >
              <Square size={10} />
              Stop
            </button>
          )}
          {status === "error" && (
            <button
              onClick={() => onRun?.(node.id)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs"
              style={{ background: "#2a3045", color: "#9ba5bc" }}
              title="再実行"
            >
              <RefreshCw size={10} />
            </button>
          )}
        </div>
      </div>

      {/* 下側のハンドル（次ノードへの接続元） */}
      <Handle type="source" position={Position.Right} style={{ background: "#2a3045", border: "2px solid #4f8ef7" }} />
    </div>
  );
}
