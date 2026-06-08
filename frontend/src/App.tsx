/**
 * Conductor メインアプリケーション
 * 3ペイン構成: 左ナビ + メインエリア + ステータスバー
 */

import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { GitBranch, List, FolderOpen, ScrollText, CheckSquare, Settings, Bell, Cpu, BookOpen } from "lucide-react";

import { PipelineView } from "./components/pipeline/PipelineView";
import { TaskBoard } from "./components/tasks/TaskBoard";
import { FileManager } from "./components/files/FileManager";
import { LogViewer } from "./components/logs/LogViewer";
import { ApprovalQueue } from "./components/approvals/ApprovalQueue";
import { AgentConfigView } from "./components/agents/AgentConfig";
import { PromptLibraryView } from "./components/prompt-library/PromptLibrary";
import { StatusBar } from "./components/common/StatusBar";

import { useWebSocket } from "./hooks/useWebSocket";
import { usePipelineStore } from "./stores/pipelineStore";
import { useAgentStore } from "./stores/agentStore";
import { useApprovalStore } from "./stores/approvalStore";
import { useNavStore } from "./stores/navStore";
import type { ViewId } from "./types";

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: "pipeline",  label: "Pipeline",        icon: <GitBranch size={16} /> },
  { id: "tasks",     label: "Tasks",           icon: <List size={16} /> },
  { id: "files",     label: "Files",           icon: <FolderOpen size={16} /> },
  { id: "logs",      label: "Logs",            icon: <ScrollText size={16} /> },
  { id: "agents",    label: "Agent Config",    icon: <Cpu size={16} /> },
  { id: "prompts",   label: "Prompt Library",  icon: <BookOpen size={16} /> },
  { id: "approvals", label: "Approvals",       icon: <CheckSquare size={16} /> },
  { id: "settings",  label: "Settings",        icon: <Settings size={16} /> },
];

/** アプリケーションルートコンポーネント */
export function App() {
  const { activeView, setView } = useNavStore();
  const { send } = useWebSocket();
  const pipeline = usePipelineStore((s) => s.pipeline);
  const runtimeStates = useAgentStore((s) => s.runtimeStates);
  const approvalQueue = useApprovalStore((s) => s.queue);

  const runningCount = Object.values(runtimeStates).filter((s) => s.status === "running").length;

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => useAgentStore.getState().setAgents(data))
      .catch(console.error);
  }, []);

  void send;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "#0d0f14" }}>
      {/* ヘッダー */}
      <header
        className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
        style={{ background: "#1a1e28", borderColor: "#2a3045" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-base font-bold tracking-wide"
            style={{ fontFamily: "'Syne', sans-serif", color: "#4f8ef7" }}
          >
            CONDUCTOR
          </span>
          {pipeline && (
            <span className="text-xs" style={{ color: "#9ba5bc" }}>
              / {pipeline.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {approvalQueue.length > 0 && (
            <button
              onClick={() => setView("approvals")}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
              style={{ background: "#a78bfa22", color: "#a78bfa" }}
            >
              <Bell size={12} />
              {approvalQueue.length} 承認待ち
            </button>
          )}
          {runningCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "#3dd68c" }}>
              <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: "#3dd68c" }} />
              {runningCount} running
            </span>
          )}
        </div>
      </header>

      {/* 本体: ナビ + コンテンツ */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左ナビゲーション */}
        <nav
          className="w-14 flex flex-col items-center py-3 gap-1 border-r flex-shrink-0"
          style={{ background: "#1a1e28", borderColor: "#2a3045" }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            const hasBadge = item.id === "approvals" && approvalQueue.length > 0;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                title={item.label}
                className="relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                style={{
                  background: isActive ? "#2a3045" : "transparent",
                  color: isActive ? "#4f8ef7" : "#9ba5bc",
                }}
              >
                {item.icon}
                {hasBadge && (
                  <span
                    className="absolute top-1 right-1 w-2 h-2 rounded-full"
                    style={{ background: "#a78bfa" }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-hidden">
          {activeView === "pipeline"  && <PipelineView />}
          {activeView === "tasks"     && <TaskBoard />}
          {activeView === "files"     && <FileManager />}
          {activeView === "logs"      && <LogViewer />}
          {activeView === "agents"    && <AgentConfigView />}
          {activeView === "prompts"   && <PromptLibraryView />}
          {activeView === "approvals" && <ApprovalQueue />}
          {activeView === "settings"  && (
            <div className="flex items-center justify-center h-full" style={{ color: "#9ba5bc" }}>
              <p className="text-sm">設定画面（準備中）</p>
            </div>
          )}
        </main>
      </div>

      {/* ステータスバー */}
      <StatusBar />

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: "#1a1e28", color: "#e8ecf4", border: "1px solid #2a3045" },
        }}
      />
    </div>
  );
}

export default App;
