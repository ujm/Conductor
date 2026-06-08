/** AgentConfig - エージェント登録・編集・CWD 設定 */

import { useState } from "react";
import { Plus, Check, X, Cpu, ChevronRight } from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import type { AgentConfig } from "../../types";

type ConnType = "cli" | "rest_api";

interface FormState {
  name: string;
  icon: string;
  color: string;
  type: ConnType;
  command: string;
  args: string;
  cwd: string;
  baseUrl: string;
  timeoutMinutes: number;
  retryCount: number;
}

const DEFAULT_FORM: FormState = {
  name: "",
  icon: "🤖",
  color: "#4f8ef7",
  type: "cli",
  command: "claude",
  args: "--dangerously-skip-permissions",
  cwd: "",
  baseUrl: "",
  timeoutMinutes: 30,
  retryCount: 2,
};

function agentToForm(agent: AgentConfig): FormState {
  return {
    name: agent.name,
    icon: agent.icon ?? "🤖",
    color: agent.color ?? "#4f8ef7",
    type: (agent.type === "cli" ? "cli" : "rest_api") as ConnType,
    command: agent.connection?.command ?? "claude",
    args: (agent.connection?.args ?? []).join(" "),
    cwd: agent.connection?.cwd ?? "",
    baseUrl: agent.connection?.baseUrl ?? "",
    timeoutMinutes: agent.defaults?.timeout_minutes ?? 30,
    retryCount: agent.defaults?.retry_count ?? 2,
  };
}

function formToBody(id: string, form: FormState): AgentConfig {
  return {
    id,
    name: form.name.trim(),
    icon: form.icon,
    color: form.color,
    type: form.type,
    connection:
      form.type === "cli"
        ? {
            command: form.command.trim() || "claude",
            args: form.args.split(" ").filter(Boolean),
            cwd: form.cwd.trim() || undefined,
          }
        : { baseUrl: form.baseUrl.trim() },
    defaults: {
      timeout_minutes: form.timeoutMinutes,
      retry_count: form.retryCount,
      approval_required: false,
      context_files: [],
    },
  };
}

// ─── 共通フィールドコンポーネント ─────────────────────────────────
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
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="text-xs rounded px-2 py-1.5 outline-none w-full disabled:opacity-50"
      style={{ background: "#0d0f14", color: "#e8ecf4", border: "1px solid #2a3045" }}
    />
  );
}

// ─── エージェント編集フォーム（新規・編集共用） ────────────────────
function AgentForm({
  agentId,
  initialForm,
  isNew,
  onSaved,
  onCancel,
}: {
  agentId: string;
  initialForm: FormState;
  isNew: boolean;
  onSaved: (agent: AgentConfig) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<FormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("名前は必須です");
      return;
    }
    if (form.type === "cli" && !form.command.trim()) {
      setError("コマンドは必須です");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = formToBody(agentId, form);
      const res = await fetch(
        isNew ? "/api/agents" : `/api/agents/${agentId}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        setError(text || `エラー: ${res.status}`);
        return;
      }
      const saved = (await res.json()) as AgentConfig;
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* フォームヘッダー */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "#2a3045" }}
      >
        <span
          className="text-sm font-semibold"
          style={{ fontFamily: "'Syne', sans-serif", color: "#e8ecf4" }}
        >
          {isNew ? "新しいエージェント" : `編集: ${agentId}`}
        </span>
        <button onClick={onCancel} style={{ color: "#9ba5bc" }}>
          <X size={14} />
        </button>
      </div>

      {/* フォームフィールド */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {/* 名前 */}
          <div>
            <FieldLabel>名前 *</FieldLabel>
            <TextInput
              value={form.name}
              onChange={(v) => set({ name: v })}
              placeholder="Claude Code"
            />
          </div>

          {/* 接続タイプ */}
          <div>
            <FieldLabel>接続タイプ</FieldLabel>
            <select
              value={form.type}
              onChange={(e) => set({ type: e.target.value as ConnType })}
              className="text-xs rounded px-2 py-1.5 outline-none w-full"
              style={{
                background: "#0d0f14",
                color: "#e8ecf4",
                border: "1px solid #2a3045",
              }}
            >
              <option value="cli">CLI</option>
              <option value="rest_api">REST API</option>
            </select>
          </div>

          {form.type === "cli" ? (
            <>
              {/* コマンド */}
              <div>
                <FieldLabel>コマンド *</FieldLabel>
                <TextInput
                  value={form.command}
                  onChange={(v) => set({ command: v })}
                  placeholder="claude"
                />
              </div>

              {/* 引数 */}
              <div>
                <FieldLabel>引数（スペース区切り）</FieldLabel>
                <TextInput
                  value={form.args}
                  onChange={(v) => set({ args: v })}
                  placeholder="--dangerously-skip-permissions"
                />
              </div>

              {/* CWD */}
              <div>
                <FieldLabel>作業ディレクトリ (CWD)</FieldLabel>
                <TextInput
                  value={form.cwd}
                  onChange={(v) => set({ cwd: v })}
                  placeholder="/Users/you/work/project  または  {project_root}"
                />
                <p
                  className="text-xs mt-1"
                  style={{ color: "#4a5568" }}
                >
                  省略すると PROJECT_ROOT が使用されます。
                  <code
                    className="px-1 rounded"
                    style={{ background: "#0d0f14", color: "#9ba5bc" }}
                  >
                    {"{project_root}"}
                  </code>{" "}
                  で置換可能。
                </p>
              </div>
            </>
          ) : (
            <div>
              <FieldLabel>Base URL</FieldLabel>
              <TextInput
                value={form.baseUrl}
                onChange={(v) => set({ baseUrl: v })}
                placeholder="http://localhost:8000"
              />
            </div>
          )}

          {/* タイムアウト */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>タイムアウト（分）</FieldLabel>
              <input
                type="number"
                value={form.timeoutMinutes}
                onChange={(e) =>
                  set({
                    timeoutMinutes: Math.max(1, parseInt(e.target.value) || 30),
                  })
                }
                className="text-xs rounded px-2 py-1.5 outline-none w-full"
                style={{
                  background: "#0d0f14",
                  color: "#e8ecf4",
                  border: "1px solid #2a3045",
                }}
              />
            </div>
            <div>
              <FieldLabel>リトライ回数</FieldLabel>
              <input
                type="number"
                value={form.retryCount}
                onChange={(e) =>
                  set({
                    retryCount: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="text-xs rounded px-2 py-1.5 outline-none w-full"
                style={{
                  background: "#0d0f14",
                  color: "#e8ecf4",
                  border: "1px solid #2a3045",
                }}
              />
            </div>
          </div>

          {/* アイコン */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>アイコン（絵文字）</FieldLabel>
              <TextInput
                value={form.icon}
                onChange={(v) => set({ icon: v })}
                placeholder="🤖"
              />
            </div>
            <div>
              <FieldLabel>カラー</FieldLabel>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => set({ color: e.target.value })}
                  className="rounded h-7 w-10 cursor-pointer"
                  style={{ background: "#0d0f14", border: "1px solid #2a3045" }}
                />
                <TextInput
                  value={form.color}
                  onChange={(v) => set({ color: v })}
                  placeholder="#4f8ef7"
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p
            className="text-xs mt-3 px-2 py-1.5 rounded"
            style={{ background: "#f05c5c22", color: "#f05c5c" }}
          >
            {error}
          </p>
        )}
      </div>

      {/* 保存ボタン */}
      <div
        className="flex gap-2 px-4 py-3 border-t"
        style={{ borderColor: "#2a3045" }}
      >
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium disabled:opacity-50"
          style={{
            background: "#3dd68c22",
            color: "#3dd68c",
            border: "1px solid #3dd68c44",
          }}
        >
          <Check size={12} />
          {saving ? "保存中..." : "保存"}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs"
          style={{ background: "#2a3045", color: "#9ba5bc" }}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

// ─── メインビュー ─────────────────────────────────────────────────
export function AgentConfigView() {
  const { agents, setAgents, updateAgent } = useAgentStore();

  // "new" = 新規追加フォーム、文字列 = 編集対象エージェントID、null = 何も選択していない
  const [selected, setSelected] = useState<string | "new" | null>(null);

  const selectedAgent =
    selected && selected !== "new"
      ? (agents.find((a) => a.id === selected) ?? null)
      : null;

  const handleSaved = (agent: AgentConfig) => {
    if (selected === "new") {
      setAgents([...agents, agent]);
    } else {
      updateAgent(agent);
    }
    setSelected(null);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ─── 左ペイン: エージェント一覧 ─── */}
      <div
        className="flex flex-col border-r"
        style={{
          width: selected ? "38%" : "100%",
          borderColor: "#2a3045",
          transition: "width 0.15s ease",
        }}
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
          style={{ borderColor: "#2a3045", background: "#1a1e28" }}
        >
          <span
            className="text-sm font-semibold"
            style={{ fontFamily: "'Syne', sans-serif", color: "#e8ecf4" }}
          >
            Agent Config
          </span>
          <button
            onClick={() => setSelected("new")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
            style={{ background: "#4f8ef7", color: "#fff" }}
          >
            <Plus size={12} />
            追加
          </button>
        </div>

        {/* エージェント一覧 */}
        <div className="flex-1 overflow-y-auto p-3">
          {agents.length === 0 && selected !== "new" ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Cpu size={32} style={{ color: "#2a3045" }} />
              <p className="text-sm" style={{ color: "#9ba5bc" }}>
                エージェントが登録されていません
              </p>
              <button
                onClick={() => setSelected("new")}
                className="text-xs px-3 py-1.5 rounded"
                style={{ background: "#4f8ef7", color: "#fff" }}
              >
                最初のエージェントを追加
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map((agent) => {
                const isActive = selected === agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() =>
                      setSelected(isActive ? null : agent.id)
                    }
                    className="w-full rounded-lg p-3 border flex items-center gap-3 text-left transition-colors"
                    style={{
                      background: isActive ? "#2a3045" : "#1a1e28",
                      borderColor: isActive ? "#4f8ef7" : "#2a3045",
                    }}
                  >
                    <span className="text-lg flex-shrink-0">
                      {agent.icon ?? "🤖"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-medium truncate"
                        style={{ color: "#e8ecf4" }}
                      >
                        {agent.name}
                      </p>
                      <p
                        className="text-xs truncate"
                        style={{ color: "#9ba5bc" }}
                      >
                        {agent.id}
                        <span
                          className="ml-1.5 px-1 py-0.5 rounded text-xs"
                          style={{ background: "#0d0f14" }}
                        >
                          {agent.type}
                        </span>
                        {agent.connection?.cwd && (
                          <span
                            className="ml-1.5 px-1 py-0.5 rounded text-xs"
                            style={{ background: "#3dd68c22", color: "#3dd68c" }}
                            title={`CWD: ${agent.connection.cwd}`}
                          >
                            cwd
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronRight
                      size={12}
                      style={{
                        color: isActive ? "#4f8ef7" : "#4a5568",
                        transform: isActive ? "rotate(90deg)" : "none",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── 右ペイン: 編集フォーム ─── */}
      {selected && (
        <div className="flex-1 overflow-hidden" style={{ minWidth: 0 }}>
          {selected === "new" ? (
            <AgentForm
              agentId=""
              initialForm={DEFAULT_FORM}
              isNew={true}
              onSaved={handleSaved}
              onCancel={() => setSelected(null)}
            />
          ) : selectedAgent ? (
            <AgentForm
              agentId={selectedAgent.id}
              initialForm={agentToForm(selectedAgent)}
              isNew={false}
              onSaved={handleSaved}
              onCancel={() => setSelected(null)}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
