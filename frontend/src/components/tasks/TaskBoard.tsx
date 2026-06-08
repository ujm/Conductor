/** TaskBoard - カンバン形式のタスク管理ボード（D&Dでステータス変更） */

import { useEffect, useState, useRef } from "react";
import { Plus } from "lucide-react";
import { useTaskStore } from "../../stores/taskStore";
import type { TaskConfig, TaskStatus } from "../../types";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo",         label: "Todo" },
  { status: "in_progress",  label: "In Progress" },
  { status: "review",       label: "Review" },
  { status: "done",         label: "Done" },
  { status: "blocked",      label: "Blocked" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low:      "#9ba5bc",
  medium:   "#4f8ef7",
  high:     "#f5a623",
  critical: "#f05c5c",
};

function TaskCard({
  task,
  onDragStart,
}: {
  task: TaskConfig;
  onDragStart: (id: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      className="rounded-lg p-3 mb-2 border cursor-grab active:cursor-grabbing transition-all duration-150 select-none"
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
    </div>
  );
}

export function TaskBoard() {
  const { tasks, setTasks, updateTask } = useTaskStore();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const dragTaskId = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => setTasks(data as TaskConfig[]))
      .catch(console.error);
  }, [setTasks]);

  const handleDragStart = (id: string) => {
    dragTaskId.current = id;
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(status);
  };

  const handleDrop = async (targetStatus: TaskStatus) => {
    const id = dragTaskId.current;
    dragTaskId.current = null;
    setDragOverCol(null);
    if (!id) return;

    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === targetStatus) return;

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
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
            onKeyDown={(e) => e.key === "Enter" && void handleCreateTask()}
            placeholder="新しいタスク..."
            className="text-xs rounded px-2 py-1 outline-none w-48"
            style={{ background: "#0d0f14", color: "#e8ecf4", border: "1px solid #2a3045" }}
          />
          <button
            onClick={() => void handleCreateTask()}
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
            const isOver = dragOverCol === col.status;
            return (
              <div
                key={col.status}
                className="w-52 flex-shrink-0"
                onDragOver={(e) => handleDragOver(e, col.status)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => void handleDrop(col.status)}
              >
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
                  className="rounded-lg p-2 min-h-[200px] transition-colors duration-150"
                  style={{
                    background: isOver ? "#2a3045" : "#1a1e28",
                    border: `1px solid ${isOver ? "#4f8ef7" : "#2a3045"}`,
                  }}
                >
                  {colTasks.map((t) => (
                    <TaskCard key={t.id} task={t} onDragStart={handleDragStart} />
                  ))}
                  {isOver && colTasks.length === 0 && (
                    <div
                      className="rounded-md h-10 border-2 border-dashed flex items-center justify-center"
                      style={{ borderColor: "#4f8ef7" }}
                    >
                      <span className="text-xs" style={{ color: "#4f8ef7" }}>ここにドロップ</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
