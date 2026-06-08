/** StatusBar - 画面下部に固定表示されるステータスバー */

import { useEffect, useState } from "react";
import { Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import { useApprovalStore } from "../../stores/approvalStore";
import { useLogStore } from "../../stores/logStore";
import { useWsStore } from "../../stores/wsStore";
import { useNavStore } from "../../stores/navStore";

/** フェードイン付きの最新ログメッセージ表示 */
function LatestEvent() {
  const entries = useLogStore((s) => s.entries);
  const latest = entries[entries.length - 1];
  const [visible, setVisible] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!latest) return;
    setMsg(`[${latest.source}] ${latest.message}`);
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, [latest]);

  if (!msg) return null;

  return (
    <span
      className="truncate max-w-xs transition-opacity duration-300"
      style={{ color: "#9ba5bc", opacity: visible ? 1 : 0 }}
      title={msg}
    >
      {msg}
    </span>
  );
}

export function StatusBar() {
  const runtimeStates = useAgentStore((s) => s.runtimeStates);
  const approvalQueue = useApprovalStore((s) => s.queue);
  const { isConnected, reconnectCount } = useWsStore();
  const setView = useNavStore((s) => s.setView);

  const states = Object.values(runtimeStates);
  const runningCount = states.filter((s) => s.status === "running").length;
  const doneCount = states.filter((s) => s.status === "done").length;
  const errorCount = states.filter((s) => s.status === "error").length;
  const warningCount = approvalQueue.length;

  return (
    <footer
      className="flex items-center gap-4 px-4 py-1 border-t flex-shrink-0 text-xs"
      style={{ background: "#1a1e28", borderColor: "#2a3045", color: "#9ba5bc" }}
    >
      {/* エージェント状態カウント */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {runningCount > 0 && (
          <span className="flex items-center gap-1" style={{ color: "#3dd68c" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: "#3dd68c" }} />
            {runningCount} running
          </span>
        )}
        {doneCount > 0 && (
          <span style={{ color: "#9ba5bc" }}>{doneCount} done</span>
        )}
        {errorCount > 0 && (
          <span style={{ color: "#f05c5c" }}>{errorCount} error</span>
        )}
      </div>

      {/* 最新イベント（フェードイン） */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <LatestEvent />
      </div>

      {/* 承認待ちバッジ */}
      {warningCount > 0 && (
        <button
          onClick={() => setView("approvals")}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: "#f5a62322", color: "#f5a623" }}
        >
          <AlertTriangle size={10} />
          {warningCount}件の承認待ち
        </button>
      )}

      {/* WS 接続インジケーター */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {isConnected ? (
          <Wifi size={11} style={{ color: "#3dd68c" }} />
        ) : (
          <>
            <WifiOff size={11} style={{ color: "#f05c5c" }} />
            {reconnectCount > 0 && (
              <span style={{ color: "#f05c5c" }}>再接続中 ({reconnectCount})</span>
            )}
          </>
        )}
      </div>
    </footer>
  );
}
