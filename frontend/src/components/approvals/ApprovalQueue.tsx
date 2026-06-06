/** ApprovalQueue - 承認待ちアクションの一覧・承認/却下 */

import { Check, X } from "lucide-react";
import { useApprovalStore } from "../../stores/approvalStore";

/** 承認ゲート管理画面 */
export function ApprovalQueue() {
  const { queue } = useApprovalStore();

  const handleApprove = async (id: string) => {
    await fetch(`/api/approvals/${id}/approve`, { method: "POST" }).catch(console.error);
  };

  const handleReject = async (id: string) => {
    await fetch(`/api/approvals/${id}/reject`, { method: "POST" }).catch(console.error);
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-2 border-b"
        style={{ borderColor: "#2a3045", background: "#1a1e28" }}
      >
        <span className="text-sm font-semibold" style={{ fontFamily: "'Syne', sans-serif", color: "#e8ecf4" }}>
          Approval Queue
          {queue.length > 0 && (
            <span
              className="ml-2 px-1.5 py-0.5 rounded-full text-xs"
              style={{ background: "#a78bfa22", color: "#a78bfa" }}
            >
              {queue.length}
            </span>
          )}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {queue.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm" style={{ color: "#9ba5bc" }}>承認待ちのアクションはありません</p>
          </div>
        ) : (
          queue.map((req) => (
            <div
              key={req.id}
              className="rounded-lg p-4 mb-3 border"
              style={{ background: "#1a1e28", borderColor: "#a78bfa44" }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium" style={{ color: "#e8ecf4" }}>
                    {req.action}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#9ba5bc" }}>
                    エージェント: {req.agentId}
                  </p>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ background: "#a78bfa22", color: "#a78bfa" }}
                >
                  承認待ち
                </span>
              </div>

              <p className="text-xs mb-3 p-2 rounded" style={{ background: "#0d0f14", color: "#9ba5bc" }}>
                {req.context}
              </p>

              <p className="text-xs mb-3" style={{ color: "#9ba5bc" }}>
                {new Date(req.created_at).toLocaleString("ja-JP")}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(req.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
                  style={{ background: "#3dd68c22", color: "#3dd68c", border: "1px solid #3dd68c44" }}
                >
                  <Check size={12} />
                  承認
                </button>
                <button
                  onClick={() => handleReject(req.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
                  style={{ background: "#f05c5c22", color: "#f05c5c", border: "1px solid #f05c5c44" }}
                >
                  <X size={12} />
                  却下
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
