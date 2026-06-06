/**
 * タスク管理 REST API ルート
 */

import { Router, type Request, type Response } from "express";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { v4 as uuidv4 } from "uuid";
import { readYaml, writeYaml } from "../utils/yaml";
import type { TaskConfig, ApiError } from "../types";

/** タスク管理ルーターを生成する */
export function createTasksRouter(conductorDir: string): Router {
  const router = Router();
  const tasksDir = path.join(conductorDir, "tasks");

  /** 全タスクを読み込むヘルパー */
  async function loadTasks(): Promise<TaskConfig[]> {
    await fs.mkdir(tasksDir, { recursive: true });
    let files: string[] = [];
    try {
      files = await fs.readdir(tasksDir);
    } catch {
      return [];
    }
    const tasks: TaskConfig[] = [];
    for (const file of files.filter((f) => f.endsWith(".yaml"))) {
      try {
        const task = await readYaml<TaskConfig>(path.join(tasksDir, file));
        tasks.push(task);
      } catch {
        // 読み込み失敗したファイルはスキップ
      }
    }
    return tasks;
  }

  /** GET /api/tasks - タスク一覧取得 */
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const tasks = await loadTasks();
      res.json(tasks);
    } catch (err) {
      const apiErr: ApiError = { error: String(err), code: "INTERNAL_ERROR" };
      res.status(500).json(apiErr);
    }
  });

  /** POST /api/tasks - タスク作成 */
  router.post("/", async (req: Request, res: Response) => {
    const body = req.body as Partial<TaskConfig>;
    if (!body.title) {
      const err: ApiError = { error: "title は必須です", code: "VALIDATION_ERROR" };
      res.status(400).json(err);
      return;
    }
    const now = new Date().toISOString();
    const task: TaskConfig = {
      id: uuidv4(),
      title: body.title,
      status: body.status ?? "todo",
      priority: body.priority ?? "medium",
      assigned_agent: body.assigned_agent ?? "",
      created_at: now,
      updated_at: now,
      description: body.description ?? "",
      acceptance_criteria: body.acceptance_criteria ?? [],
      linked_files: body.linked_files ?? [],
    };
    try {
      await writeYaml(path.join(tasksDir, `${task.id}.yaml`), task);
      res.status(201).json(task);
    } catch (err) {
      const apiErr: ApiError = { error: String(err), code: "INTERNAL_ERROR" };
      res.status(500).json(apiErr);
    }
  });

  /** PUT /api/tasks/:id - タスク更新 */
  router.put("/:id", async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const filePath = path.join(tasksDir, `${id}.yaml`);
    try {
      const existing = await readYaml<TaskConfig>(filePath);
      const updated: TaskConfig = {
        ...existing,
        ...(req.body as Partial<TaskConfig>),
        id,
        updated_at: new Date().toISOString(),
      };
      await writeYaml(filePath, updated);
      res.json(updated);
    } catch {
      const err: ApiError = { error: `タスク ${id} が見つかりません`, code: "NOT_FOUND" };
      res.status(404).json(err);
    }
  });

  return router;
}
