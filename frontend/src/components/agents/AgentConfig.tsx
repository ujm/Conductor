/** AgentConfig - S-05: エージェント登録・編集・接続テスト */

import { useState } from "react";
import { Plus, Check, X, Cpu } from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import type { AgentConfig } from "../../types";

type ConnType = "cli" | "rest_api";

const EMPTY_FORM = {
  id: "",
  name: "",
  icon: "🤖",
  color: "#4f8ef7",
  type: "cli" as ConnType,
  command: "claude",
  args: "--dangerously-skip-permissions",
  cwd: "",
  baseUrl: "",
  timeoutMinutes: 30,
  retryCount: 2,
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs mb-1 block" style={{ color: "#9ba5bc" }}>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="text-xs rounded px-2 py-1.5 outline-none w-full"
      style={{ background: "#0d0f14", color: "#e8ecf4", border: "1px solid #2a3045" }}
    />
  );
}

function AddAgentForm({ onSaved, onCancel }: { onSaved: (a: AgentConfig) => void; onCancel: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<typeof EMPTY_FORM>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    if (!form.id.trim() || !form.name.trim()) {
      setError("ID と名前は必須です");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        id: form.id.trim(),
        name: form.name.trim(),
        icon: form.icon,
        color: form.color,
        type: form.type,
        connection: form.type === "cli"
          ? { command: form.command, args: form.args.split(" ").filter(Boolean), cwd: form.cwd || undefined }
          : { baseUrl: form.baseUrl },
        defaults: {
          timeout_minutes: form.timeoutMinutes,
          retry_count: form.retryCount,
          approval_required: false,
          context_files: [],
        },
      };
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || `エラー: ${res.status}`);
        return;
      }
      const saved = await res.json() as AgentConfig;
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-lg p-4 mb-4 border"
      style={{ background: "#1a1e28", borderColor: "#4f8ef7" }}
    >
      <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "'Syne', sans-serif", color: "#e8ecf4" }}>
        新しいエージェント
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>ID *</FieldLabel>
          <TextInput value={form.id} onChange={(v) => set({ id: v })} placeholder="claude-code" />
        </div>
        <div>
          <FieldLabel>名前 *</FieldLabel>
          <TextInput value={form.name} onChange={(v) => set({ name: v })} placeholder="Claude Code" />
        </div>
        <div>
          <FieldLabel>接続タイプ</FieldLabel>
          <select
            value={form.type}
            onChange={(e) => set({ type: e.target.value as ConnType })}
            className="text-xs rounded px-2 py-1.5 outline-none w-full"
            style={{ background: "#0d0f14", color: "#e8ecf4", border: "1px solid #2a3045" }}
          >
            <option value="cli">CLI</option>
            <option value="rest_api">REST API</option>
          </select>
        </div>
        <div>
          <FieldLabel>アイコン（絵文字）</FieldLabel>
          <TextInput value={form.icon} onChange={(v) => set({ icon: v })} placeholder="🤖" />
        </div>

        {form.type === "cli" ? (
          <>
            <div>
              <FieldLabel>コマンド</FieldLabel>
              <TextInput value={form.command} onChange={(v) => set({ command: v })} placeholder="claude" />
            </div>
            <div>
              <FieldLabel>引数（スペース区切り）</FieldLabel>
              <TextInput value={form.args} onChange={(v) => set({ args: v })} placeholder="--dangerously-skip-permissions" />
            </div>
            <div>
              <FieldLabel>作業ディレクトリ（省略可）</FieldLabel>
              <TextInput value={form.cwd} onChange={(v) => set({ cwd: v })} placeholder="{project_root}" />
            </div>
          </>
        ) : (
          <div className="col-span-2">
            <FieldLabel>Base URL</FieldLabel>
            <TextInput value={form.baseUrl} onChange={(v) => set({ baseUrl: v })} placeholder="http://localhost:8000" />
          </div>
        )}

        <div>
          <FieldLabel>タイムアウト（分）</FieldLabel>
          <input
            type="number"
            value={form.timeoutMinutes}
            onChange={(e) => set({ timeoutMinutes: Math.max(1, parseInt(e.target.value) || 30) })}
            className="text-xs rounded px-2 py-1.5 outline-none w-full"
            style={{ background: "#0d0f14", color: "#e8ecf4", border: "1px solid #2a3045" }}
          />
        </div>
        <div>
          <FieldLabel>リトライ回数</FieldLabel>
          <input
            type="number"
            value={form.retryCount}
            onChange={(e) => set({ retryCount: Math.max(0, parseInt(e.target.value) || 0) })}
            className="text-xs rounded px-2 py-1.5 outline-none w-full"
            style={{ background: "#0d0f14", color: "#e8ecf4", border: "1px solid #2a3045" }}
          />
        </div>
      </div>

      {error && (
        <p className="text-xs mt-2 px-2 py-1.5 rounded" style={{ background: "#f05c5c22", color: "#f05c5c" }}>
          {error}
        </p>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
          style={{ background: "#3dd68c22", color: "#3dd68c", border: "1px solid #3dd68c44" }}
        >
          <Check size={12} />
          {saving ? "保存中..." : "保存"}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
          style={{ background: "#f05c5c22", color: "#f05c5c", border: "1px solid #f05c5c44" }}
        >
          <X size={12} />
          キャンセル
        </button>
      </div>
    </div>
  );
}

export function AgentConfigView() {
  const { agents, setAgents } = useAgentStore();
  const [showForm, setShowForm] = useState(false);

  const handleSaved = (agent: AgentConfig) => {
    setAgents([...agents, agent]);
    setShowForm(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "#2a3045", background: "#1a1e28" }}
      >
        <span className="text-sm font-semibold" style={{ fontFamily: "'Syne', sans-serif", color: "#e8ecf4" }}>
          Agent Config
        </span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
          style={{ background: "#4f8ef7", color: "#fff" }}
        >
          <Plus size={12} />
          エージェント追加
        </button>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-4">
        {showForm && (
          <AddAgentForm
            onSaved={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        )}

        {agents.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <Cpu size={32} style={{ color: "#2a3045" }} />
            <p className="text-sm" style={{ color: "#9ba5bc" }}>
              エージェントが登録されていません
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="text-xs px-3 py-1.5 rounded"
              style={{ background: "#4f8ef7", color: "#fff" }}
            >
              最初のエージェントを追加
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-lg p-4 border flex items-center gap-3"
                style={{ background: "#1a1e28", borderColor: "#2a3045" }}
              >
                <span className="text-xl">{agent.icon ?? "🤖"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#e8ecf4" }}>{agent.name}</p>
                  <p className="text-xs" style={{ color: "#9ba5bc" }}>
                    {agent.id}
                    <span
                      className="ml-2 px-1.5 py-0.5 rounded"
                      style={{ background: "#2a3045" }}
                    >
                      {agent.type}
                    </span>
                  </p>
                </div>
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: agent.color ?? "#4f8ef7" }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
