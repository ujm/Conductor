/** PromptLibrary - プロンプトテンプレート管理画面 */

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Eye, EyeOff, FolderOpen, Save, Link } from "lucide-react";
import { usePromptStore } from "../../stores/promptStore";
import { usePipelineStore } from "../../stores/pipelineStore";
import type { PromptTemplate, PromptVariable, PipelineNode } from "../../types";

// ─── ハイライト付きプレビュー ──────────────────────────────────────
function HighlightedTemplate({ template }: { template: string }) {
  const parts = template.split(/({{[^}]+}})/g);
  return (
    <div
      className="text-xs font-mono whitespace-pre-wrap break-words rounded p-2 min-h-[60px]"
      style={{ background: "#0d0f14", color: "#9ba5bc", border: "1px solid #2a3045" }}
    >
      {parts.map((part, i) => {
        if (part.startsWith("{{") && part.endsWith("}}")) {
          return (
            <span key={i} style={{ color: "#f5a623", background: "#f5a62322", borderRadius: 2, padding: "0 2px" }}>
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

// ─── 変数入力フォーム ──────────────────────────────────────────────
function VariableInputs({
  variables,
  values,
  onChange,
}: {
  variables: Record<string, PromptVariable>;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const entries = Object.entries(variables);
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold" style={{ color: "#9ba5bc" }}>変数</p>
      {entries.map(([key, def]) => (
        <div key={key}>
          <label className="text-xs mb-1 block" style={{ color: "#9ba5bc" }}>
            {def.label}
            {def.required && <span style={{ color: "#f05c5c" }}> *</span>}
          </label>
          {def.type === "select" && def.options ? (
            <select
              value={values[key] ?? def.default ?? ""}
              onChange={(e) => onChange(key, e.target.value)}
              className="text-xs rounded px-2 py-1.5 outline-none w-full"
              style={{ background: "#0d0f14", color: "#e8ecf4", border: "1px solid #2a3045" }}
            >
              <option value="">選択してください</option>
              {def.options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <div className="flex gap-1">
              <input
                type={def.type === "number" ? "number" : "text"}
                value={values[key] ?? def.default ?? ""}
                onChange={(e) => onChange(key, e.target.value)}
                placeholder={def.default ?? `${key} を入力`}
                className="text-xs rounded px-2 py-1.5 outline-none flex-1"
                style={{ background: "#0d0f14", color: "#e8ecf4", border: "1px solid #2a3045" }}
              />
              {def.type === "file_path" && (
                <button
                  title="ファイルを選択"
                  className="px-2 py-1.5 rounded text-xs flex-shrink-0"
                  style={{ background: "#2a3045", color: "#9ba5bc" }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.onchange = () => {
                      if (input.files?.[0]) {
                        onChange(key, input.files[0].name);
                      }
                    };
                    input.click();
                  }}
                >
                  <FolderOpen size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── パイプライン紐付けモーダル ───────────────────────────────────
function UsePipelineModal({
  promptId,
  onClose,
}: {
  promptId: string;
  onClose: () => void;
}) {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    if (!selected || !pipeline) return;
    setSaving(true);
    setError(null);
    try {
      const updated = {
        ...pipeline,
        agents: pipeline.agents.map((n: PipelineNode) =>
          n.id === selected ? { ...n, prompt_id: promptId } : n,
        ),
      };
      const res = await fetch("/api/pipeline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) {
        setError(`保存失敗: ${res.status}`);
        return;
      }
      usePipelineStore.getState().setPipeline(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-lg p-5 w-80 border"
        style={{ background: "#1a1e28", borderColor: "#2a3045" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: "#e8ecf4" }}>
          パイプラインノードに紐付け
        </h3>
        {!pipeline || pipeline.agents.length === 0 ? (
          <p className="text-xs" style={{ color: "#9ba5bc" }}>パイプラインにノードがありません</p>
        ) : (
          <div className="space-y-1 mb-4">
            {pipeline.agents.map((n: PipelineNode) => (
              <button
                key={n.id}
                onClick={() => setSelected(n.id)}
                className="w-full text-left text-xs px-3 py-2 rounded transition-colors"
                style={{
                  background: selected === n.id ? "#4f8ef722" : "#0d0f14",
                  color: selected === n.id ? "#4f8ef7" : "#9ba5bc",
                  border: `1px solid ${selected === n.id ? "#4f8ef7" : "#2a3045"}`,
                }}
              >
                {n.agent} — {n.task || "タスク未設定"}
              </button>
            ))}
          </div>
        )}
        {error && (
          <p className="text-xs mb-2 px-2 py-1 rounded" style={{ background: "#f05c5c22", color: "#f05c5c" }}>
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => void handleApply()}
            disabled={!selected || saving}
            className="flex-1 text-xs py-1.5 rounded disabled:opacity-50"
            style={{ background: "#4f8ef7", color: "#fff" }}
          >
            {saving ? "保存中..." : "適用"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 text-xs py-1.5 rounded"
            style={{ background: "#2a3045", color: "#9ba5bc" }}
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── テンプレートエディター ───────────────────────────────────────
function TemplateEditor({
  template,
  onSaved,
  onDeleted,
}: {
  template: PromptTemplate | null;
  onSaved: (t: PromptTemplate) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [category, setCategory] = useState(template?.category ?? "general");
  const [text, setText] = useState(template?.template ?? "");
  const [variables, setVariables] = useState<Record<string, PromptVariable>>(template?.variables ?? {});
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(template?.name ?? "");
    setCategory(template?.category ?? "general");
    setText(template?.template ?? "");
    setVariables(template?.variables ?? {});
    setVarValues({});
    setPreviewText(null);
    setShowPreview(false);
  }, [template?.id]);

  // テキスト変更時に変数を自動抽出
  const handleTextChange = useCallback((value: string) => {
    setText(value);
    setPreviewText(null);

    const matches = value.matchAll(/\{\{(\w+)\}\}/g);
    const newVars: Record<string, PromptVariable> = {};
    for (const [, varName] of matches) {
      if (varName) {
        newVars[varName] = variables[varName] ?? { type: "string", label: varName, required: true };
      }
    }
    setVariables(newVars);
  }, [variables]);

  const handlePreview = async () => {
    if (!template?.id) {
      // 未保存の場合はフロントエンドで仮解決
      let resolved = text;
      for (const [key, val] of Object.entries(varValues)) {
        resolved = resolved.replaceAll(`{{${key}}}`, val || `[${key}]`);
      }
      setPreviewText(resolved);
      setShowPreview(true);
      return;
    }
    try {
      const res = await fetch(`/api/prompts/${template.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables: varValues }),
      });
      const data = await res.json() as { resolved?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "プレビュー失敗");
        return;
      }
      setPreviewText(data.resolved ?? "");
      setShowPreview(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !text.trim()) {
      setError("名前とテンプレートは必須です");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const method = template?.id ? "PUT" : "POST";
      const url = template?.id ? `/api/prompts/${template.id}` : "/api/prompts";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, template: text, variables }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "保存失敗");
        return;
      }
      const saved = await res.json() as PromptTemplate;
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!template?.id) return;
    if (!confirm(`"${template.name}" を削除しますか？`)) return;
    await fetch(`/api/prompts/${template.id}`, { method: "DELETE" });
    onDeleted(template.id);
  };

  if (!template && text === "") {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: "#2a3045" }}>
        <p className="text-sm">テンプレートを選択するか、新規作成してください</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3 overflow-y-auto">
      {/* 名前・カテゴリ */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs mb-1 block" style={{ color: "#9ba5bc" }}>テンプレート名 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="テンプレート名"
            className="text-xs rounded px-2 py-1.5 outline-none w-full"
            style={{ background: "#0d0f14", color: "#e8ecf4", border: "1px solid #2a3045" }}
          />
        </div>
        <div className="w-32">
          <label className="text-xs mb-1 block" style={{ color: "#9ba5bc" }}>カテゴリ</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="general"
            className="text-xs rounded px-2 py-1.5 outline-none w-full"
            style={{ background: "#0d0f14", color: "#e8ecf4", border: "1px solid #2a3045" }}
          />
        </div>
      </div>

      {/* テンプレート編集エリア */}
      <div>
        <label className="text-xs mb-1 block" style={{ color: "#9ba5bc" }}>
          テンプレート（<span style={{ color: "#f5a623" }}>{"{{変数名}}"}</span> で変数を挿入）
        </label>
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          rows={8}
          placeholder="プロンプトを入力してください。{{変数名}} で変数を埋め込めます。"
          className="text-xs rounded px-2 py-1.5 outline-none w-full font-mono resize-y"
          style={{ background: "#0d0f14", color: "#e8ecf4", border: "1px solid #2a3045" }}
        />
      </div>

      {/* ハイライト付きプレビュー */}
      {text && (
        <div>
          <label className="text-xs mb-1 block" style={{ color: "#9ba5bc" }}>構文ハイライト</label>
          <HighlightedTemplate template={text} />
        </div>
      )}

      {/* 変数入力フォーム */}
      <VariableInputs
        variables={variables}
        values={varValues}
        onChange={(k, v) => setVarValues((prev) => ({ ...prev, [k]: v }))}
      />

      {/* プレビュー結果 */}
      {showPreview && previewText !== null && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs" style={{ color: "#9ba5bc" }}>解決済みプレビュー</label>
            <button onClick={() => setShowPreview(false)} className="text-xs" style={{ color: "#9ba5bc" }}>
              <EyeOff size={12} />
            </button>
          </div>
          <div
            className="text-xs font-mono whitespace-pre-wrap break-words rounded p-2"
            style={{ background: "#0d0f14", color: "#3dd68c", border: "1px solid #2a3045" }}
          >
            {previewText}
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs px-2 py-1.5 rounded" style={{ background: "#f05c5c22", color: "#f05c5c" }}>
          {error}
        </p>
      )}

      {/* アクションボタン */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs disabled:opacity-50"
          style={{ background: "#4f8ef7", color: "#fff" }}
        >
          <Save size={11} />
          {saving ? "保存中..." : "保存"}
        </button>
        <button
          onClick={() => void handlePreview()}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs"
          style={{ background: "#2a3045", color: "#9ba5bc" }}
        >
          <Eye size={11} />
          プレビュー
        </button>
        {template?.id && (
          <>
            <button
              onClick={() => setShowPipelineModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs"
              style={{ background: "#3dd68c22", color: "#3dd68c", border: "1px solid #3dd68c44" }}
            >
              <Link size={11} />
              パイプラインで使用
            </button>
            <button
              onClick={() => void handleDelete()}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs ml-auto"
              style={{ background: "#f05c5c22", color: "#f05c5c" }}
            >
              <Trash2 size={11} />
              削除
            </button>
          </>
        )}
      </div>

      {showPipelineModal && template?.id && (
        <UsePipelineModal
          promptId={template.id}
          onClose={() => setShowPipelineModal(false)}
        />
      )}
    </div>
  );
}

// ─── メインビュー ─────────────────────────────────────────────────
export function PromptLibraryView() {
  const { templates, setTemplates, upsertTemplate, removeTemplate } = usePromptStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetch("/api/prompts")
      .then((r) => r.json())
      .then((data) => setTemplates(data as PromptTemplate[]))
      .catch(console.error);
  }, [setTemplates]);

  const selectedTemplate = isNew ? null : templates.find((t) => t.id === selectedId) ?? null;

  // カテゴリ別にグループ化
  const categories = Array.from(new Set(templates.map((t) => t.category))).sort();

  const handleSaved = (saved: PromptTemplate) => {
    upsertTemplate(saved);
    setSelectedId(saved.id);
    setIsNew(false);
  };

  const handleDeleted = (id: string) => {
    removeTemplate(id);
    if (selectedId === id) {
      setSelectedId(null);
      setIsNew(false);
    }
  };

  const handleNew = () => {
    setSelectedId(null);
    setIsNew(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
        style={{ borderColor: "#2a3045", background: "#1a1e28" }}
      >
        <span className="text-sm font-semibold" style={{ fontFamily: "'Syne', sans-serif", color: "#e8ecf4" }}>
          Prompt Library
        </span>
        <button
          onClick={handleNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs"
          style={{ background: "#4f8ef7", color: "#fff" }}
        >
          <Plus size={12} />
          新規テンプレート
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左：テンプレート一覧 */}
        <div
          className="w-56 flex-shrink-0 border-r overflow-y-auto py-2"
          style={{ borderColor: "#2a3045", background: "#0d0f14" }}
        >
          {templates.length === 0 && !isNew ? (
            <p className="text-xs px-4 py-6 text-center" style={{ color: "#9ba5bc" }}>
              テンプレートがありません
            </p>
          ) : (
            categories.map((cat) => (
              <div key={cat} className="mb-2">
                <p className="text-xs px-3 py-1 font-semibold uppercase tracking-wide" style={{ color: "#2a3045" }}>
                  {cat}
                </p>
                {templates
                  .filter((t) => t.category === cat)
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedId(t.id); setIsNew(false); }}
                      className="w-full text-left px-3 py-2 text-xs transition-colors"
                      style={{
                        background: selectedId === t.id && !isNew ? "#1a1e28" : "transparent",
                        color: selectedId === t.id && !isNew ? "#e8ecf4" : "#9ba5bc",
                        borderLeft: `2px solid ${selectedId === t.id && !isNew ? "#4f8ef7" : "transparent"}`,
                      }}
                    >
                      <span className="truncate block">{t.name}</span>
                    </button>
                  ))}
              </div>
            ))
          )}
          {isNew && (
            <div
              className="mx-3 my-1 px-2 py-1.5 rounded text-xs"
              style={{ background: "#4f8ef722", color: "#4f8ef7", border: "1px solid #4f8ef744" }}
            >
              新規テンプレート
            </div>
          )}
        </div>

        {/* 右：エディター */}
        <TemplateEditor
          template={isNew ? { id: "", name: "", category: "general", tags: [], template: "", variables: {}, created_at: "", updated_at: "" } : selectedTemplate}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      </div>
    </div>
  );
}
