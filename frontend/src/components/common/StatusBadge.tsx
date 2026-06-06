/** エージェント状態バッジコンポーネント */

import type { AgentStatus } from "../../types";

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; pulse: boolean }> = {
  idle:     { label: "idle",     color: "#9ba5bc", pulse: false },
  running:  { label: "running",  color: "#3dd68c", pulse: true  },
  waiting:  { label: "waiting",  color: "#f5a623", pulse: false },
  paused:   { label: "paused",   color: "#4f8ef7", pulse: false },
  approval: { label: "approval", color: "#a78bfa", pulse: true  },
  done:     { label: "done",     color: "#4f8ef7", pulse: false },
  error:    { label: "error",    color: "#f05c5c", pulse: false },
};

interface StatusBadgeProps {
  status: AgentStatus;
}

/** ステータスを色付きドット + ラベルで表示するバッジ */
export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, color, pulse } = STATUS_CONFIG[status];

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
      <span
        className={`w-2 h-2 rounded-full inline-block${pulse ? " animate-pulse-dot" : ""}`}
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
