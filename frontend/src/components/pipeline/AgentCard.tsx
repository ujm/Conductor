/**
 * AgentCard - パイプライン上のエージェントノードコンポーネント
 * React Flow の custom node として使用する
 */

import { useState, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Play, Square, RefreshCw, Trash2 } from "lucide-react";
import { StatusBadge } from "../common/StatusBadge";
import { useAgentStore } from "../../stores/agentStore";
import type { PipelineNode } from "../../types";

export interface AgentNodeData {
  node: PipelineNode;
  onRun?: (nodeId: string) => void;
  onStop?: (nodeId: string) => void;
  onTaskChange?: (nodeId: string, task: string) => void;
  onDelete?: (nodeId: string) => void;
  [key: string]: unknown;
}

/** パイプライン上のエージェントカードノード */
export function AgentCard({ data }: NodeProps) {
  const nodeData = data as AgentNodeData;
  const { node, onRun, onStop, onTaskChange, onDelete } = nodeData;
  const runtimeState = useAgentStore((s) => s.runtimeStates[node.id]);
  const status = runtimeState?.status ?? "idle";
  const progress = runtimeState?.progress ?? 0;
  const isRunning = status === "running";

  const [editing, setEditing] = useState(false);
  const [editTask, setEditTask] = useState(node.task);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // ノードが更新されたら編集バッファを同期する
  useEffect(() => {
    if (!editing) setEditTask(node.task);
  }, [node.task, editing]);

  const commitEdit = () => {
    setEditing(false);
    if (editTask !== node.task) {
      onTaskChange?.(node.id, editTask);
    }
  };

  const handleDelete = () => {
    if (confirm(`ノード "${node.agent}" をパイプラインから削除しますか？`)) {
      onDelete?.(node.id);
    }
  };

  return (
    <div
      className="relative min-w-[220px] rounded-lg border transition-all duration-150 cursor-default select-none"
      style={{
        background: "#1a1e28",
        borderColor: isRunning ? "#3dd68c" : "#2a3045",
        boxShadow: isRunning ? "0 0 12px rgba(61, 214, 140, 0.2)" : "none",
      }}
    >
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
          <div className="flex items-center gap-1">
            <StatusBadge status={status} />
            <button
              onClick={handleDelete}
              className="ml-1 p-0.5 rounded opacity-40 hover:opacity-100 transition-opacity"
              style={{ color: "#f05c5c" }}
              title="削除"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {/* タスク（クリックでインライン編集） */}
        {editing ? (
          <input
            ref={inputRef}
            value={editTask}
            onChange={(e) => setEditTask(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") { setEditing(false); setEditTask(node.task); }
            }}
            className="text-xs rounded px-1.5 py-1 outline-none w-full mb-2"
            style={{ background: "#0d0f14", color: "#e8ecf4", border: "1px solid #4f8ef7" }}
            placeholder="タスクを入力..."
          />
        ) : (
          <p
            className="text-xs mb-2 line-clamp-2 cursor-text rounded px-1 -mx-1 transition-colors"
            style={{ color: node.task ? "#9ba5bc" : "#2a3045" }}
            title={node.task || "クリックしてタスクを入力"}
            onClick={() => setEditing(true)}
          >
            {node.task || "クリックしてタスクを入力..."}
          </p>
        )}

        {/* プロンプトバッジ */}
        {node.prompt_id && (
          <span
            className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded mb-2"
            style={{ background: "#f5a62322", color: "#f5a623" }}
            title={`プロンプト: ${node.prompt_id}`}
          >
            📋 {node.prompt_id}
          </span>
        )}

        {/* プログレスバー */}
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

      <Handle type="source" position={Position.Right} style={{ background: "#2a3045", border: "2px solid #4f8ef7" }} />
    </div>
  );
}
