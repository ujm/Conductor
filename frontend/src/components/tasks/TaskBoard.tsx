/** TaskBoard - カンバン形式のタスク管理ボード */

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useTaskStore } from "../../stores/taskStore";
import type { TaskConfig, TaskStatus } from "../../types";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo",        label: "Todo" },
  { status: "in_progress", label: "In Progress" },
  { status: "review",      label: "Review" },
  { status: "done",        label: "Done" },
  { status: "blocked",     label: "Blocked" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low:      "#9ba5bc",
  medium:   "#4f8ef7",
  high:     "#f5a623",
  critical: "#f05c5c",
};

/** カンバンのタスクカード */
function TaskCard({ task, onStatusChange }: { task: TaskConfig; onStatusChange: (id: string, status: TaskStatus) => void }) {
  return (
    <div
      className="rounded-lg p-3 mb-2 border cursor-pointer transition-all duration-150"
      style={{ background: "#0d0f14", borderColor: "#2a3045" }}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <p className="text-xs font-medium" style={{ color: "#e8ecf4" }}>{task.title}</p>
        <span
          className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: "#2a3045", color: PRIORITY_COLORS[task.priority] ?? "#9ba5bc" }}
        >
          {task.priority}
        </span>
      </div>
      {task.assigned_agent && (
        <p className="text-xs" style={{ color: "#9ba5bc" }}>{task.assigned_agent}</p>
      )}
      {/* ステータス変更セレクト */}
      <select
        value={task.status}
        onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
        onClick={(e) => e.stopPropagation()}
        className="mt-2 text-xs rounded px-1 py-0.5 w-full outline-none"
        style={{ background: "#1a1e28", color: "#9ba5bc", border: "1px solid #2a3045" }}
      >
        {COLUMNS.map((c) => (
          <option key={c.status} value={c.status}>{c.label}</option>
        ))}
      </select>
    </div>
  );
}

/** カンバン形式のタスクボード */
export function TaskBoard() {
  const { tasks, setTasks, updateTask } = useTaskStore();
  const [newTaskTitle, setNewTaskTitle] = useState("");

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => setTasks(data as TaskConfig[]))
      .catch(console.error);
  }, [setTasks]);

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const updated = await res.json() as TaskConfig;
      updateTask(updated);
    } catch (err) {
      console.error("タスク更新エラー:", err);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTaskTitle }),
      });
      const created = await res.json() as TaskConfig;
      setTasks([...tasks, created]);
      setNewTaskTitle("");
    } catch (err) {
      console.error("タスク作成エラー:", err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ツールバー */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b"
        style={{ borderColor: "#2a3045", background: "#1a1e28" }}
      >
        <span className="text-sm font-semibold" style={{ fontFamily: "'Syne', sans-serif", color: "#e8ecf4" }}>
          Task Board
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
            placeholder="新しいタスク..."
            className="text-xs rounded px-2 py-1 outline-none w-48"
            style={{ background: "#0d0f14", color: "#e8ecf4", border: "1px solid #2a3045" }}
          />
          <button
            onClick={handleCreateTask}
            className="p-1 rounded transition-colors"
            style={{ background: "#4f8ef7", color: "#fff" }}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* カンバンボード */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className="w-52 flex-shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold" style={{ color: "#9ba5bc" }}>
                    {col.label}
                  </span>
                  <span
                    className="text-xs px-1.5 rounded-full"
                    style={{ background: "#2a3045", color: "#9ba5bc" }}
                  >
                    {colTasks.length}
                  </span>
                </div>
                <div
                  className="rounded-lg p-2 min-h-[200px]"
                  style={{ background: "#1a1e28", border: "1px solid #2a3045" }}
                >
                  {colTasks.map((t) => (
                    <TaskCard key={t.id} task={t} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
