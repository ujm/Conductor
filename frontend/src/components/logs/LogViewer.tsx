/** LogViewer - リアルタイムログ表示コンポーネント */

import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { useLogStore } from "../../stores/logStore";
import { useAgentStore } from "../../stores/agentStore";

const LEVEL_COLORS = {
  info:  "#9ba5bc",
  warn:  "#f5a623",
  error: "#f05c5c",
  debug: "#4f8ef7",
};

/** ログビューアー（エージェント別フィルタ・リアルタイム追記） */
export function LogViewer() {
  const { entries, filterAgentId, setFilterAgentId, clearEntries } = useLogStore();
  const agents = useAgentStore((s) => s.agents);
  const bottomRef = useRef<HTMLDivElement>(null);

  const filtered = filterAgentId
    ? entries.filter((e) => e.agentId === filterAgentId || e.source === filterAgentId)
    : entries;

  // 新しいエントリが追加されたら最下部にスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filtered.length]);

  return (
    <div className="flex flex-col h-full">
      {/* ツールバー */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "#2a3045", background: "#1a1e28" }}
      >
        <span className="text-sm font-semibold" style={{ fontFamily: "'Syne', sans-serif", color: "#e8ecf4" }}>
          Log Viewer
        </span>
        <div className="flex items-center gap-2">
          <select
            value={filterAgentId ?? ""}
            onChange={(e) => setFilterAgentId(e.target.value || null)}
            className="text-xs rounded px-2 py-1 outline-none"
            style={{ background: "#0d0f14", color: "#9ba5bc", border: "1px solid #2a3045" }}
          >
            <option value="">全エージェント</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button
            onClick={clearEntries}
            className="p-1 rounded transition-colors hover:opacity-70"
            style={{ color: "#9ba5bc" }}
            title="クリア"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ログ本体 */}
      <div
        className="flex-1 overflow-y-auto p-3 font-mono text-xs"
        style={{ background: "#0d0f14" }}
      >
        {filtered.length === 0 ? (
          <p style={{ color: "#9ba5bc" }}>ログはありません</p>
        ) : (
          filtered.map((entry, i) => (
            <div key={i} className="flex gap-2 leading-relaxed">
              <span style={{ color: "#4f8ef7", flexShrink: 0 }}>
                {new Date(entry.timestamp).toLocaleTimeString("ja-JP")}
              </span>
              {entry.source && (
                <span style={{ color: "#9ba5bc", flexShrink: 0 }}>[{entry.source}]</span>
              )}
              <span style={{ color: LEVEL_COLORS[entry.level] ?? "#9ba5bc", wordBreak: "break-all" }}>
                {entry.message}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
