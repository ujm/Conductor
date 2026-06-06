/**
 * エージェント管理 REST API ルート
 */

import { Router, type Request, type Response } from "express";
import type { OrchestratorService } from "../services/OrchestratorService";
import type { AgentConfig, ApiError } from "../types";

/** エージェント管理ルーターを生成する */
export function createAgentsRouter(orchestrator: OrchestratorService): Router {
  const router = Router();

  /** GET /api/agents - エージェント一覧取得 */
  router.get("/", (_req: Request, res: Response) => {
    res.json(orchestrator.getAgents());
  });

  /** POST /api/agents - エージェント登録 */
  router.post("/", async (req: Request, res: Response) => {
    const config = req.body as AgentConfig;
    if (!config.id || !config.name || !config.type) {
      const err: ApiError = { error: "id, name, type は必須です", code: "VALIDATION_ERROR" };
      res.status(400).json(err);
      return;
    }
    try {
      await orchestrator.registerAgent(config);
      res.status(201).json(config);
    } catch (err) {
      const apiErr: ApiError = { error: String(err), code: "INTERNAL_ERROR" };
      res.status(500).json(apiErr);
    }
  });

  /** POST /api/agents/:id/run - 単一エージェント実行 */
  router.post("/:id/run", async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const pipeline = orchestrator.getPipeline();
    const node = pipeline?.agents.find((n) => n.id === id || n.agent === id);
    if (!node) {
      const err: ApiError = { error: `ノード ${id} が見つかりません`, code: "NOT_FOUND" };
      res.status(404).json(err);
      return;
    }
    try {
      void orchestrator.runNode(node);
      res.json({ message: "起動しました", nodeId: node.id });
    } catch (err) {
      const apiErr: ApiError = { error: String(err), code: "INTERNAL_ERROR" };
      res.status(500).json(apiErr);
    }
  });

  /** POST /api/agents/:id/stop - 単一エージェント停止 */
  router.post("/:id/stop", async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    try {
      await orchestrator.stopNode(id);
      res.json({ message: "停止しました", nodeId: id });
    } catch (err) {
      const apiErr: ApiError = { error: String(err), code: "INTERNAL_ERROR" };
      res.status(500).json(apiErr);
    }
  });

  return router;
}
